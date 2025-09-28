// server.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Allowed origins
const allowedOrigins = ['https://chat-zone.tech', 'https://www.chat-zone.tech'];

// CORS middleware (dynamic origin)
app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

// Multer setup with file size limit (adjust as needed)
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
});

app.post('/api/generate', upload.single('photo'), async (req, res) => {
    try {
        const { text, pos } = req.body;
        const filePath = req.file.path;

        // Load original image
        const image = sharp(filePath);
        const meta = await image.metadata();
        const stripHeight = 120;

        // Create SVG text overlay
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

        // Clean up temp file
        fs.unlink(filePath, () => { });

        res.setHeader('Content-Type', 'image/jpeg');
        res.send(finalImage);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Global error handler (ensures CORS headers even on errors)
app.use((err, req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).send('File too large');
    }
    res.status(500).send('Server error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Chat-Zone backend running on port ${PORT}`));
