import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

const app = express();
const httpServer = createServer(app);

declare module "http" {
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

// Serve static frontend files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve(__dirname, "../dist/public")));
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// API Gateway Info endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Tatum API Gateway",
    version: "1.0.0",
    description: "Enterprise-grade blockchain API gateway supporting 130+ blockchains",
    status: "running",
    endpoints: {
      health: "GET /api/health",
      pricing: "GET /api/pricing",
      chains: "GET /api/chains",
      docs: "https://github.com/MasterFital/tatum-api-gateway#api-documentation",
    },
    docs: "https://api.tatum.io/docs",
    github: "https://github.com/MasterFital/tatum-api-gateway",
  });
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Fallback handler: serve SPA for non-API routes, 404 for API routes
  app.use((req, res) => {
    // For API routes, return JSON 404
    if (req.path.startsWith("/api")) {
      res.status(404).json({
        error: "Not Found",
        path: req.path,
        message: "This API endpoint does not exist. See GET / for available endpoints.",
      });
    } else {
      // For non-API routes, serve the SPA index.html for client-side routing
      res.sendFile(resolve(__dirname, "../dist/public/index.html"));
    }
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`API Gateway running on port ${port}`);
      log(`Environment: ${process.env.NODE_ENV || "development"}`);
      if (process.env.TATUM_API_KEY) {
        log("✓ Tatum API configured");
      } else {
        log("⚠ WARNING: TATUM_API_KEY not configured");
      }
    },
  );
})();
