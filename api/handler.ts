import express from 'express';
import { registerRoutes } from '../server/routes';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

const app = express();
const httpServer = createServer(app);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Initialize routes
(async () => {
  await registerRoutes(httpServer, app);

  // Serve static frontend files for non-API routes
  app.get('/', (req, res) => {
    try {
      const indexPath = resolve(__dirname, 'dist/public/index.html');
      const html = readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.json({
        name: 'Tatum API Gateway',
        version: '1.0.0',
        description: 'Enterprise-grade blockchain API gateway supporting 130+ blockchains',
        status: 'running',
      });
    }
  });

  // Fallback for other non-API routes
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        message: 'This API endpoint does not exist. See GET / for available endpoints.',
      });
    } else {
      try {
        const indexPath = resolve(__dirname, 'dist/public/index.html');
        const html = readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } catch (error) {
        res.status(404).json({ error: 'Not found' });
      }
    }
  });
})();

export default app;
