import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const allowedOrigins = ['https://chat-zone.tech', 'https://www.chat-zone.tech', 'http://localhost:4200'];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/api/generate', upload.single('photo'), async (req, res) => {
    try {
        const { text, desc } = req.body;
        const filePath = req.file.path;

        const image = sharp(filePath);
        const meta = await image.metadata();

        // -------------------
        // TOP STRIP (desc)
        // -------------------
        let topStripHeight = 0;
        let topSvgBuffer = null;
        if (desc && desc.trim() !== '') {
            const topFontSize = Math.round(meta.width * 0.1); // 10% of image width
            topStripHeight = topFontSize + 20; // 10px padding above & below
            const topSvg = `
            <svg width="${meta.width}" height="${topStripHeight}">
                <rect x="0" y="0" width="${meta.width}" height="${topStripHeight}" fill="white"/>
                <text x="50%" y="50%" font-size="${topFontSize}" text-anchor="middle"
                      dominant-baseline="middle" fill="black" font-family="Arial, sans-serif">
                  ${desc}
                </text>
            </svg>`;
            topSvgBuffer = Buffer.from(topSvg);
        }

        // -------------------
        // BOTTOM STRIP (size + price)
        // -------------------
        const bottomFontSize = Math.round(meta.width * 0.098);
        const bottomStripHeight = bottomFontSize + 20; // 10px padding above & below
        const bottomSvg = `
        <svg width="${meta.width}" height="${bottomStripHeight}">
            <rect x="0" y="0" width="${meta.width}" height="${bottomStripHeight}" fill="white"/>
            <text x="50%" y="50%" font-size="${bottomFontSize}" text-anchor="middle"
                  dominant-baseline="middle" fill="black" font-family="Arial, sans-serif">
              ${text}
            </text>
        </svg>`;
        const bottomSvgBuffer = Buffer.from(bottomSvg);

        // -------------------
        // Compose final image
        // -------------------
        const finalHeight = topStripHeight + meta.height + bottomStripHeight;
        const compositeArray = [];

        if (topSvgBuffer) compositeArray.push({ input: topSvgBuffer, top: 0, left: 0 });
        compositeArray.push({ input: filePath, top: topStripHeight, left: 0 });
        compositeArray.push({ input: bottomSvgBuffer, top: topStripHeight + meta.height, left: 0 });

        const finalImage = await sharp({
            create: { width: meta.width, height: finalHeight, channels: 4, background: 'white' }
        }).composite(compositeArray).jpeg().toBuffer();

        fs.unlink(filePath, () => { });

        res.setHeader('Content-Type', 'image/jpeg');
        res.send(finalImage);
        console.log('✅ Photo generated. Top strip:', topStripHeight, 'Bottom strip:', bottomStripHeight);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.use((err, req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).send('File too large');
    res.status(500).send('Server error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Photo Editor V.4.6 backend running on port ${PORT}`));
