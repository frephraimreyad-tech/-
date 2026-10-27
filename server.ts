import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const DIST_DIR = path.join(__dirname, 'dist');

// Serve static files from dist
app.use(express.static(DIST_DIR));

// Cloud Run health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// SPA fallback for all client routes
app.get('*', (_req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>لوحة شرف الفرق العشرة</title>
          <meta http-equiv="refresh" content="3">
        </head>
        <body style="background:#070A1E;color:#f59e0b;font-family:sans-serif;text-align:center;padding:60px 20px;">
          <h2>جاري تهيئة النظام...</h2>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
