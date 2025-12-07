const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001; // Changed to 3001 to avoid conflict with Nexus
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY;
const KLING_API_BASE = 'https://api-beijing.klingai.com';
const NEXUS_AUTH_URL = process.env.NEXUS_AUTH_URL || 'http://localhost:3000';

const prisma = new PrismaClient();

// Cookie configuration
const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 6 * 60 * 60 * 1000 // 6 hours
};

// Generate JWT token for Kling API authentication
function generateKlingToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: KLING_ACCESS_KEY,
        exp: now + 1800,
        nbf: now - 5
    };
    return jwt.sign(payload, KLING_SECRET_KEY, { algorithm: 'HS256' });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.static('.'));

// --- Authentication Middleware ---
async function authenticateSession(req, res, next) {
    const sessionId = req.cookies['session_id'];
    if (!sessionId) {
        req.user = null;
        return next();
    }

    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { teacher: true }
        });

        if (!session || !session.isActive) {
            res.clearCookie('session_id');
            res.clearCookie('role');
            res.clearCookie('student_id');
            req.user = null;
            return next();
        }

        req.session = session;

        const role = req.cookies['role'];
        if (role === 'teacher') {
            req.user = { role: 'teacher', ...session.teacher };
        } else if (role === 'student') {
            const studentId = req.cookies['student_id'];
            if (studentId) {
                const student = await prisma.student.findUnique({
                    where: { id: studentId }
                });
                if (student && student.sessionId === session.id && student.status === 'ACTIVE') {
                    req.user = { role: 'student', ...student };
                }
            }
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
    }
    next();
}

app.use(authenticateSession);

// --- API Routes ---

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        hasApiKey: !!(KLING_ACCESS_KEY && KLING_SECRET_KEY),
        db: 'connected'
    });
});

// Teacher Login
app.post('/api/teacher/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Verify with Nexus
        const authRes = await fetch(`${NEXUS_AUTH_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!authRes.ok) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const authData = await authRes.json();
        if (!authData.success) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const externalUsername = authData.user.username;

        // Find or create teacher
        let teacher = await prisma.teacher.findUnique({
            where: { username: externalUsername }
        });

        if (!teacher) {
            teacher = await prisma.teacher.create({
                data: { username: externalUsername, passwordHash: '' }
            });
        }

        // Deactivate old sessions
        await prisma.session.updateMany({
            where: { teacherId: teacher.id, isActive: true },
            data: { isActive: false, endedAt: new Date() }
        });

        // Create new session
        const classroomCode = Math.floor(10000000 + Math.random() * 90000000).toString();
        const session = await prisma.session.create({
            data: {
                teacherId: teacher.id,
                classroomCode,
                isActive: true
            }
        });

        res.cookie('session_id', session.id, COOKIE_OPTIONS);
        res.cookie('role', 'teacher', COOKIE_OPTIONS);

        res.json({ success: true, session, teacher });
    } catch (error) {
        console.error('Teacher login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Student Login
app.post('/api/student/login', async (req, res) => {
    const { classroomCode, name } = req.body;

    try {
        const session = await prisma.session.findUnique({
            where: { classroomCode }
        });

        if (!session || !session.isActive) {
            return res.status(404).json({ message: 'Invalid or inactive classroom code' });
        }

        const existing = await prisma.student.findUnique({
            where: {
                sessionId_username: {
                    sessionId: session.id,
                    username: name
                }
            }
        });

        if (existing && existing.status === 'REMOVED') {
            return res.status(403).json({ message: 'You have been removed from this session' });
        }

        if (existing) {
            return res.status(409).json({ message: 'Nickname already taken' });
        }

        const student = await prisma.student.create({
            data: {
                username: name,
                sessionId: session.id,
                status: 'ACTIVE'
            }
        });

        res.cookie('session_id', session.id, COOKIE_OPTIONS);
        res.cookie('role', 'student', COOKIE_OPTIONS);
        res.cookie('student_id', student.id, COOKIE_OPTIONS);

        res.json({ success: true, session, student });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get Session Info
app.get('/api/session', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json({ user: req.user, session: req.session });
});

// End Session
app.post('/api/session/end', async (req, res) => {
    if (!req.user || req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    await prisma.session.update({
        where: { id: req.session.id },
        data: { isActive: false, endedAt: new Date() }
    });

    res.clearCookie('session_id');
    res.clearCookie('role');
    res.json({ success: true });
});

// Teacher Activity Feed
app.get('/api/teacher/activity', async (req, res) => {
    if (!req.user || req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const submissions = await prisma.videoSubmission.findMany({
        where: { sessionId: req.session.id },
        include: { student: true },
        orderBy: { createdAt: 'desc' }
    });

    const students = await prisma.student.findMany({
        where: { sessionId: req.session.id, status: 'ACTIVE' }
    });

    res.json({ submissions, students });
});

// --- Video Generation Routes (Modified) ---

// Text to Video
app.post('/api/text2video', async (req, res) => {
    if (!req.user || req.user.role !== 'student') {
        return res.status(403).json({ error: 'Must be logged in to generate videos' });
    }

    try {
        if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
            return res.status(500).json({ error: 'API keys not configured' });
        }

        const token = generateKlingToken();
        const response = await fetch(`${KLING_API_BASE}/v1/videos/text2video`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Record submission
        if (data.data?.task_id) {
            await prisma.videoSubmission.create({
                data: {
                    sessionId: req.session.id,
                    studentId: req.user.id,
                    taskId: data.data.task_id,
                    prompt: req.body.prompt || 'Text to Video',
                    status: 'PENDING'
                }
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Text2Video error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Image to Video
app.post('/api/image2video', async (req, res) => {
    if (!req.user || req.user.role !== 'student') {
        return res.status(403).json({ error: 'Must be logged in to generate videos' });
    }

    try {
        if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
            return res.status(500).json({ error: 'API keys not configured' });
        }

        const token = generateKlingToken();
        const response = await fetch(`${KLING_API_BASE}/v1/videos/image2video`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Record submission
        if (data.data?.task_id) {
            await prisma.videoSubmission.create({
                data: {
                    sessionId: req.session.id,
                    studentId: req.user.id,
                    taskId: data.data.task_id,
                    prompt: req.body.prompt || 'Image to Video',
                    status: 'PENDING'
                }
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Image2Video error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Status Check (Generic for both)
app.get('/api/video/status/:taskId', async (req, res) => {
    // Allow both teacher and student to check status
    if (!req.user) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        // Determine type by checking DB or just try both endpoints? 
        // Kling API endpoints are specific. 
        // However, the original code had specific endpoints.
        // I'll keep the original endpoints but add DB update logic.
        // Actually, I'll just use the original endpoints structure but add DB update.
        // But wait, the original code had /api/text2video/:taskId and /api/image2video/:taskId
        // I should preserve those routes.
        res.status(404).json({ error: 'Use specific endpoint' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function updateSubmissionStatus(taskId, data) {
    const status = data.data?.task_status;
    if (!status) return;

    let dbStatus = 'PENDING';
    if (status === 'succeed') dbStatus = 'SUCCESS';
    if (status === 'failed') dbStatus = 'ERROR';

    // Get video URL if succeeded
    // Kling response structure for success?
    // Usually data.data.task_result.videos[0].url
    let videoUrl = null;
    if (status === 'succeed' && data.data?.task_result?.videos?.length > 0) {
        videoUrl = data.data.task_result.videos[0].url;
    }

    try {
        await prisma.videoSubmission.update({
            where: { taskId },
            data: {
                status: dbStatus,
                videoUrl: videoUrl
            }
        });
    } catch (e) {
        // Ignore if not found (might be old task)
        console.log('Update status failed for task', taskId, e.message);
    }
}

// Text to Video Status
app.get('/api/text2video/:taskId', async (req, res) => {
    try {
        const token = generateKlingToken();
        const response = await fetch(`${KLING_API_BASE}/v1/videos/text2video/${req.params.taskId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.ok) {
            await updateSubmissionStatus(req.params.taskId, data);
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Image to Video Status
app.get('/api/image2video/:taskId', async (req, res) => {
    try {
        const token = generateKlingToken();
        const response = await fetch(`${KLING_API_BASE}/v1/videos/image2video/${req.params.taskId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.ok) {
            await updateSubmissionStatus(req.params.taskId, data);
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
