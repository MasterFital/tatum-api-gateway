import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { Tenant, TIER_LIMITS } from "@shared/schema";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      requestId: string;
      isAdmin?: boolean;
      metered?: {
        action: string;
        units: number;
        credits: number;
      };
    }
  }
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `tatum_${crypto.randomBytes(28).toString("hex")}`;
  const prefix = key.substring(0, 16);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function generateHmacSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function signRequest(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
  const expected = signRequest(payload, secret);
  if (signature.length !== expected.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function generateRequestId(): string {
  return `req_${crypto.randomBytes(16).toString("hex")}`;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = generateRequestId();
  res.setHeader("X-Request-ID", req.requestId);

  const apiKey = req.headers["x-api-key"] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "Missing API key",
      requestId: req.requestId,
    });
  }

  const apiKeyHash = hashApiKey(apiKey);
  const tenant = await storage.getTenantByApiKeyHash(apiKeyHash);
  
  if (!tenant) {
    return res.status(401).json({
      success: false,
      error: "Invalid API key",
      requestId: req.requestId,
    });
  }

  if (tenant.status !== "active") {
    return res.status(403).json({
      success: false,
      error: `Account is ${tenant.status}`,
      requestId: req.requestId,
    });
  }

  req.tenant = tenant;
  next();
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = generateRequestId();
  res.setHeader("X-Request-ID", req.requestId);
  
  const apiKey = req.headers["x-api-key"] as string;
  
  if (apiKey) {
    const apiKeyHash = hashApiKey(apiKey);
    storage.getTenantByApiKeyHash(apiKeyHash).then(tenant => {
      if (tenant && tenant.status === "active") {
        req.tenant = tenant;
      }
      next();
    }).catch(() => next());
  } else {
    next();
  }
}

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = generateRequestId();
  res.setHeader("X-Request-ID", req.requestId);

  const adminKey = req.headers["x-admin-key"] as string;
  
  if (!ADMIN_API_KEY) {
    return res.status(503).json({
      success: false,
      error: "Admin API not configured",
      requestId: req.requestId,
    });
  }

  if (!adminKey) {
    return res.status(401).json({
      success: false,
      error: "Missing admin API key",
      requestId: req.requestId,
    });
  }

  const adminKeyHash = crypto.createHash("sha256").update(adminKey).digest("hex");
  const expectedHash = crypto.createHash("sha256").update(ADMIN_API_KEY).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(adminKeyHash), Buffer.from(expectedHash))) {
    return res.status(401).json({
      success: false,
      error: "Invalid admin API key",
      requestId: req.requestId,
    });
  }

  req.isAdmin = true;
  next();
}

const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) return next();

  const key = req.tenant.id;
  const now = Date.now();
  const windowMs = 1000;
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;
  
  const limit = req.tenant.rateLimit;
  const remaining = Math.max(0, limit - entry.count);
  
  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

  if (entry.count > limit) {
    return res.status(429).json({
      success: false,
      error: "Rate limit exceeded",
      requestId: req.requestId,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  next();
}

export function tierCheckMiddleware(requiredFeature?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        requestId: req.requestId,
      });
    }

    const tierLimits = TIER_LIMITS[req.tenant.tier as keyof typeof TIER_LIMITS];
    
    if (!tierLimits) {
      return res.status(403).json({
        success: false,
        error: "Invalid tier configuration",
        requestId: req.requestId,
      });
    }

    if (requiredFeature === "kms" && !tierLimits.kmsAllowed) {
      return res.status(403).json({
        success: false,
        error: "KMS is not available in your tier. Upgrade to Scale or Enterprise.",
        requestId: req.requestId,
        upgrade: true,
      });
    }

    if (requiredFeature === "archival" && !tierLimits.archivalAccess) {
      return res.status(403).json({
        success: false,
        error: "Archival access is not available in your tier. Upgrade to Enterprise.",
        requestId: req.requestId,
        upgrade: true,
      });
    }

    next();
  };
}

export function chainAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) return next();

  const chain = req.params.chain || req.body?.chain;
  if (!chain) return next();

  const tierLimits = TIER_LIMITS[req.tenant.tier as keyof typeof TIER_LIMITS];
  const allowedChains = tierLimits?.chains || req.tenant.allowedChains;

  if (!allowedChains.includes(chain)) {
    return res.status(403).json({
      success: false,
      error: `Chain '${chain}' is not available in your tier`,
      allowedChains,
      requestId: req.requestId,
      upgrade: true,
    });
  }

  next();
}
