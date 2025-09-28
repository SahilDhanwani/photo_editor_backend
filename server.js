// server.js
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Allowed frontend origins
const allowedOrigins = ['https://chat-zone.tech', 'https://www.chat-zone.tech'];

// -------------------------------
// CORS Middleware (preflight safe)
// -------------------------------
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// -------------------------------
// Multer Setup
// -------------------------------
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max, adjust as needed
});

// -------------------------------
// POST /api/generate
// -------------------------------
app.post('/api/generate', upload.single('photo'), async (req, res) => {
    try {
        const { text, pos } = req.body;
        const filePath = req.file.path;

        // Load image
        const image = sharp(filePath);
        const meta = await image.metadata();
        const stripHeight = 120;

        // SVG text overlay
        const svg = `
      <svg width="${meta.width}" height="${stripHeight}">
        <rect x="0" y="0" width="${meta.width}" height="${stripHeight}" fill="white"/>
        <text x="50%" y="50%" font-size="42" text-anchor="middle"
              dominant-baseline="middle" fill="black" font-family="Arial, sans-serif">
          ${text}
        </text>
      </svg>
    `;
        const svgBuffer = Buffer.from(svg);

        // Compose final image
        let finalImage;
        if (pos === 'above') {
            finalImage = await sharp({
                create: { width: meta.width, height: meta.height + stripHeight, channels: 4, background: 'white' }
            })
                .composite([
                    { input: svgBuffer, top: 0, left: 0 },
                    { input: filePath, top: stripHeight, left: 0 }
                ])
                .jpeg()
                .toBuffer();
        } else {
            finalImage = await sharp({
                create: { width: meta.width, height: meta.height + stripHeight, channels: 4, background: 'white' }
            })
                .composite([
                    { input: filePath, top: 0, left: 0 },
                    { input: svgBuffer, top: meta.height, left: 0 }
                ])
                .jpeg()
                .toBuffer();
        }

        // Delete temp file
        fs.unlink(filePath, () => { });

        res.setHeader('Content-Type', 'image/jpeg');
        res.send(finalImage);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// -------------------------------
// Global Error Handler
// -------------------------------
app.use((err, req, res, next) => {
    // Ensure CORS headers are always sent
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).send('File too large');
    }

    res.status(500).send('Server error');
});

// -------------------------------
// Start server
// -------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Photo Editor V.4.4 backend running on port ${PORT}`));
