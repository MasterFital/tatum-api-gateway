import express from 'express';
import { registerRoutes } from '../server/routes';
import { createServer } from 'http';
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

// Serve static frontend files
const publicDir = resolve(__dirname, 'dist/public');
app.use(express.static(publicDir));

// API Gateway Info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Tatum API Gateway',
    version: '1.0.0',
    description: 'Enterprise-grade blockchain API gateway supporting 130+ blockchains',
    status: 'running',
    endpoints: {
      health: 'GET /api/health',
      pricing: 'GET /api/pricing',
      chains: 'GET /api/chains',
      docs: 'https://github.com/MasterFital/tatum-api-gateway#api-documentation',
    },
    docs: 'https://api.tatum.io/docs',
    github: 'https://github.com/MasterFital/tatum-api-gateway',
  });
});

// Initialize routes
(async () => {
  await registerRoutes(httpServer, app);

  // Fallback handler
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        message: 'This API endpoint does not exist. See GET / for available endpoints.',
      });
    } else {
      res.sendFile(resolve(__dirname, 'dist/public/index.html'));
    }
  });
})();

// Export for Vercel
export default app;
