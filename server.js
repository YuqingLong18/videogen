const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const KLING_API_KEY = process.env.KLING_API_KEY;
const KLING_API_BASE = 'https://api.klingai.com';

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
        hasApiKey: !!KLING_API_KEY
    });
});

// Text to Video - Submit
app.post('/api/text2video', async (req, res) => {
    try {
        if (!KLING_API_KEY) {
            return res.status(500).json({
                error: 'API key not configured. Please set KLING_API_KEY in .env file'
            });
        }

        const response = await fetch(`${KLING_API_BASE}/v1/videos/text2video`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KLING_API_KEY}`,
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
        if (!KLING_API_KEY) {
            return res.status(500).json({
                error: 'API key not configured'
            });
        }

        const response = await fetch(
            `${KLING_API_BASE}/v1/videos/text2video/${req.params.taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${KLING_API_KEY}`
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
        if (!KLING_API_KEY) {
            return res.status(500).json({
                error: 'API key not configured. Please set KLING_API_KEY in .env file'
            });
        }

        const response = await fetch(`${KLING_API_BASE}/v1/videos/image2video`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KLING_API_KEY}`,
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
        if (!KLING_API_KEY) {
            return res.status(500).json({
                error: 'API key not configured'
            });
        }

        const response = await fetch(
            `${KLING_API_BASE}/v1/videos/image2video/${req.params.taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${KLING_API_KEY}`
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
    console.log(`API Key configured: ${!!KLING_API_KEY}`);
    if (!KLING_API_KEY) {
        console.warn('⚠️  WARNING: KLING_API_KEY not set in .env file');
    }
});
