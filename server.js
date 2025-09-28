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
app.use(cors({
    origin: 'https://chat-zone.tech'
}));

const upload = multer({ dest: 'uploads/' });

app.post('/api/generate', upload.single('photo'), async (req, res) => {
    try {
        const { text, pos } = req.body; // pos is 'below' but we keep it for future
        const filePath = req.file.path;

        // Load the original image
        const image = sharp(filePath);
        const meta = await image.metadata();

        // White strip height (adjust as needed)
        const stripHeight = 120;

        // Create a white strip with text
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

        let finalImage;

        if (pos === 'above') {
            // Optional future use
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
            // Default: text below image
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Sai Fashions backend running on port ${PORT}`));
