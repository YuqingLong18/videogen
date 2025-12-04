const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY;
const KLING_API_BASE = 'https://api-beijing.klingai.com';

// Generate JWT token for Kling API authentication
function generateKlingToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: KLING_ACCESS_KEY,  // Access Key as issuer
        exp: now + 1800,         // Token expires in 30 minutes
        nbf: now - 5             // Token valid from 5 seconds ago
    };

    return jwt.sign(payload, KLING_SECRET_KEY, { algorithm: 'HS256' });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Serve static files
app.use(express.static('.'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        hasApiKey: !!(KLING_ACCESS_KEY && KLING_SECRET_KEY)
    });
});

// Text to Video - Submit
app.post('/api/text2video', async (req, res) => {
    try {
        if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
            return res.status(500).json({
                error: 'API keys not configured. Please set KLING_ACCESS_KEY and KLING_SECRET_KEY in .env file'
            });
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

        res.json(data);
    } catch (error) {
        console.error('Text2Video error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Text to Video - Get Status
app.get('/api/text2video/:taskId', async (req, res) => {
    try {
        if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
            return res.status(500).json({
                error: 'API keys not configured'
            });
        }

        const token = generateKlingToken();

        const response = await fetch(
            `${KLING_API_BASE}/v1/videos/text2video/${req.params.taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Text2Video status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Image to Video - Submit
app.post('/api/image2video', async (req, res) => {
    try {
        if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
            return res.status(500).json({
                error: 'API keys not configured. Please set KLING_ACCESS_KEY and KLING_SECRET_KEY in .env file'
            });
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

        res.json(data);
    } catch (error) {
        console.error('Image2Video error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Image to Video - Get Status
app.get('/api/image2video/:taskId', async (req, res) => {
    try {
        if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
            return res.status(500).json({
                error: 'API keys not configured'
            });
        }

        const token = generateKlingToken();

        const response = await fetch(
            `${KLING_API_BASE}/v1/videos/image2video/${req.params.taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Image2Video status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Access Key configured: ${!!KLING_ACCESS_KEY}`);
    console.log(`Secret Key configured: ${!!KLING_SECRET_KEY}`);
    if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
        console.warn('⚠️  WARNING: KLING_ACCESS_KEY and KLING_SECRET_KEY must be set in .env file');
    }
});
