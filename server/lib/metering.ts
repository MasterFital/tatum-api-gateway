import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { PRICING } from "@shared/schema";

type PricingAction = keyof typeof PRICING;

export function meterEndpoint(action: PricingAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) return next();

    const pricing = PRICING[action];
    req.metered = {
      action,
      units: pricing.units,
      credits: pricing.cost,
    };

    const originalJson = res.json.bind(res);
    
    res.json = (data: any) => {
      const startTime = Date.now();
      
      storage.recordApiUsage({
        tenantId: req.tenant!.id,
        endpoint: req.path,
        method: req.method,
        chain: req.params.chain || req.body?.chain || null,
        action,
        units: pricing.units,
        credits: pricing.cost,
        statusCode: res.statusCode,
        requestId: req.requestId,
        responseTimeMs: Date.now() - startTime,
        metadata: {
          userAgent: req.headers["user-agent"],
          ip: req.ip,
        },
      }).catch(console.error);

      if (data && typeof data === "object") {
        data.meta = {
          ...data.meta,
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          metered: {
            action,
            units: pricing.units,
            credits: pricing.cost,
          },
        };
      }

      return originalJson(data);
    };

    next();
  };
}

export async function getMonthlyUsage(tenantId: string): Promise<{
  totalRequests: number;
  totalUnits: number;
  totalCredits: number;
  costUsd: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const stats = await storage.getApiUsageStats(tenantId, startOfMonth, now);
  
  return {
    totalRequests: stats.totalRequests,
    totalUnits: stats.totalUnits,
    totalCredits: stats.totalCredits,
    costUsd: stats.totalCredits,
  };
}

export async function checkQuota(tenantId: string, monthlyQuota: number): Promise<{
  allowed: boolean;
  used: number;
  remaining: number;
  percentUsed: number;
}> {
  if (monthlyQuota === -1) {
    return { allowed: true, used: 0, remaining: -1, percentUsed: 0 };
  }

  const usage = await getMonthlyUsage(tenantId);
  const used = Math.floor(usage.totalUnits);
  const remaining = monthlyQuota - used;
  const percentUsed = (used / monthlyQuota) * 100;

  return {
    allowed: remaining > 0,
    used,
    remaining: Math.max(0, remaining),
    percentUsed: Math.min(100, percentUsed),
  };
}

export function quotaMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) return next();

  checkQuota(req.tenant.id, req.tenant.monthlyQuota).then(quota => {
    res.setHeader("X-Quota-Used", quota.used);
    res.setHeader("X-Quota-Remaining", quota.remaining);
    res.setHeader("X-Quota-Percent", Math.round(quota.percentUsed));

    if (!quota.allowed) {
      return res.status(429).json({
        success: false,
        error: "Monthly quota exceeded",
        requestId: req.requestId,
        quota: {
          used: quota.used,
          limit: req.tenant!.monthlyQuota,
          percentUsed: quota.percentUsed,
        },
        upgrade: true,
      });
    }

    next();
  }).catch(() => next());
}
