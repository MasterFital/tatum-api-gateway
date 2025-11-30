import express from 'express';
import { registerRoutes } from '../server/routes';
import { createServer } from 'http';

const app = express();

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

let initialized = false;

const initializeOnce = async () => {
  if (initialized) return;
  initialized = true;
  
  const httpServer = createServer();
  await registerRoutes(httpServer, app);
  
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        message: 'This API endpoint does not exist. See GET / for available endpoints.',
      });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });
};

app.use(async (req, res, next) => {
  await initializeOnce();
  next();
});

export default app;
