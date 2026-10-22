import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const DIST_DIR = path.join(__dirname, 'dist');

// Serve static assets from dist
app.use(express.static(DIST_DIR));

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// SPA fallback for all routes
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>جاري تشغيل النظام</title>
          <meta http-equiv="refresh" content="2">
        </head>
        <body style="background:#070A1E;color:#f59e0b;font-family:sans-serif;text-align:center;padding:60px 20px;">
          <h2>جاري تهيئة لوحة الشرف...</h2>
          <p style="color:#94a3b8;font-size:14px;">يرجى الانتظار ثوانٍ قليلة...</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
