import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { tatumClient, getPricing, getChainInfo } from "./lib/tatum";
import { seedDemoData } from "./seed";
import { 
  authMiddleware, 
  optionalAuthMiddleware,
  adminAuthMiddleware,
  rateLimitMiddleware, 
  tierCheckMiddleware, 
  chainAccessMiddleware,
  generateApiKey, 
  hashApiKey, 
  generateHmacSecret,
  generateRequestId,
} from "./lib/auth";
import { meterEndpoint, quotaMiddleware, getMonthlyUsage, checkQuota } from "./lib/metering";
import { 
  TIER_LIMITS, 
  PRICING, 
  WEBHOOK_EVENTS, 
  SUPPORTED_CHAINS,
  insertTenantSchema,
  insertAddressSchema,
  insertWebhookSchema,
} from "@shared/schema";

const CreateTenantSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  tier: z.enum(["starter", "scale", "enterprise"]).default("starter"),
  companyName: z.string().optional(),
  website: z.string().url().optional(),
  billingEmail: z.string().email().optional(),
});

const CreateAddressSchema = z.object({
  chain: z.string(),
  label: z.string().optional(),
  tags: z.array(z.string()).optional(),
  webhookUrl: z.string().url().optional(),
});

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS as any)).min(1),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  seedDemoData().catch(console.error);

  app.get("/api/health", async (req, res) => {
    const tatumHealth = await tatumClient.healthCheck();
    res.json({
      success: true,
      status: "healthy",
      services: {
        api: "healthy",
        database: "healthy",
        tatum: tatumHealth.success ? "healthy" : "degraded",
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/pricing", (req, res) => {
    res.json({
      success: true,
      pricing: PRICING,
      tiers: Object.entries(TIER_LIMITS).map(([id, limits]) => ({
        id,
        ...limits,
        pricing: {
          starter: { monthly: 0, included: 10000 },
          scale: { monthly: 99, included: 100000 },
          enterprise: { monthly: "custom", included: "unlimited" },
        }[id],
      })),
    });
  });

  app.get("/api/chains", (req, res) => {
    res.json({
      success: true,
      chains: SUPPORTED_CHAINS,
      total: SUPPORTED_CHAINS.length,
    });
  });

  app.post("/api/tenants", async (req, res) => {
    try {
      const data = CreateTenantSchema.parse(req.body);
      
      const existing = await storage.getTenantByEmail(data.email);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: "Email already registered",
        });
      }

      const { key: apiKey, prefix: apiKeyPrefix, hash: apiKeyHash } = generateApiKey();
      const tierLimits = TIER_LIMITS[data.tier];

      const tenant = await storage.createTenant({
        name: data.name,
        email: data.email,
        tier: data.tier,
        status: "active",
        apiKeyPrefix,
        apiKeyHash,
        hmacSecret: generateHmacSecret(),
        allowedChains: tierLimits.chains as string[],
        maxAddresses: tierLimits.maxAddresses,
        maxWebhooks: tierLimits.maxWebhooks,
        maxVirtualAccounts: tierLimits.maxVirtualAccounts,
        rateLimit: tierLimits.rateLimit,
        monthlyQuota: tierLimits.monthlyQuota,
        companyName: data.companyName,
        website: data.website,
        billingEmail: data.billingEmail,
      });

      await storage.createAuditLog({
        tenantId: tenant.id,
        action: "tenant.created",
        resource: "tenant",
        resourceId: tenant.id,
        changes: { tier: data.tier },
      });

      res.status(201).json({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
          tier: tenant.tier,
          status: tenant.status,
          apiKey,
          hmacSecret: tenant.hmacSecret,
          limits: {
            chains: tenant.allowedChains,
            maxAddresses: tenant.maxAddresses,
            maxWebhooks: tenant.maxWebhooks,
            maxVirtualAccounts: tenant.maxVirtualAccounts,
            rateLimit: tenant.rateLimit,
            monthlyQuota: tenant.monthlyQuota,
          },
          createdAt: tenant.createdAt,
        },
        warning: "Save your API key now. It cannot be retrieved again.",
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: error.errors,
        });
      }
      console.error("Create tenant error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.get("/api/tenants", async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      
      const tenantsWithStats = await Promise.all(
        tenants.map(async (t) => {
          const usage = await getMonthlyUsage(t.id);
          const addressCount = await storage.countAddressesByTenant(t.id);
          
          return {
            id: t.id,
            name: t.name,
            email: t.email,
            tier: t.tier,
            status: t.status,
            companyName: t.companyName,
            addressCount,
            usage: {
              requests: usage.totalRequests,
              units: Math.floor(usage.totalUnits),
              costUsd: usage.costUsd.toFixed(4),
            },
            createdAt: t.createdAt,
          };
        })
      );

      res.json({ success: true, tenants: tenantsWithStats });
    } catch (error) {
      console.error("Get tenants error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.get("/api/tenants/:id", authMiddleware, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: "Tenant not found" });
      }

      const usage = await getMonthlyUsage(tenant.id);
      const quota = await checkQuota(tenant.id, tenant.monthlyQuota);
      const addressCount = await storage.countAddressesByTenant(tenant.id);
      const webhookCount = await storage.countWebhooksByTenant(tenant.id);
      const vaCount = await storage.countVirtualAccountsByTenant(tenant.id);

      res.json({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
          tier: tenant.tier,
          status: tenant.status,
          companyName: tenant.companyName,
          website: tenant.website,
          billingEmail: tenant.billingEmail,
          apiKeyPrefix: tenant.apiKeyPrefix,
          limits: {
            chains: tenant.allowedChains,
            maxAddresses: tenant.maxAddresses,
            maxWebhooks: tenant.maxWebhooks,
            maxVirtualAccounts: tenant.maxVirtualAccounts,
            rateLimit: tenant.rateLimit,
            monthlyQuota: tenant.monthlyQuota,
          },
          usage: {
            addresses: addressCount,
            webhooks: webhookCount,
            virtualAccounts: vaCount,
            requests: usage.totalRequests,
            units: Math.floor(usage.totalUnits),
            costUsd: usage.costUsd.toFixed(4),
            quota: {
              used: quota.used,
              remaining: quota.remaining,
              percentUsed: Math.round(quota.percentUsed),
            },
          },
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        },
      });
    } catch (error) {
      console.error("Get tenant error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.patch("/api/tenants/:id", authMiddleware, async (req, res) => {
    try {
      if (req.tenant!.id !== req.params.id) {
        return res.status(403).json({
          success: false,
          error: "You can only update your own account",
          requestId: req.requestId,
        });
      }

      const updates = req.body;
      const allowedUpdates = ["name", "companyName", "website", "billingEmail"];
      const sanitizedUpdates: Record<string, any> = {};
      
      for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
          sanitizedUpdates[key] = updates[key];
        }
      }

      if (Object.keys(sanitizedUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid fields to update",
          requestId: req.requestId,
        });
      }

      const tenant = await storage.updateTenant(req.params.id, sanitizedUpdates);
      if (!tenant) {
        return res.status(404).json({ success: false, error: "Tenant not found" });
      }

      await storage.createAuditLog({
        tenantId: tenant.id,
        action: "tenant.updated",
        resource: "tenant",
        resourceId: tenant.id,
        changes: sanitizedUpdates,
        ipAddress: req.ip,
      });

      res.json({ success: true, tenant, requestId: req.requestId });
    } catch (error) {
      console.error("Update tenant error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.post("/api/tenants/:id/rotate-key", authMiddleware, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: "Tenant not found" });
      }

      if (req.tenant!.id !== tenant.id) {
        return res.status(403).json({ 
          success: false, 
          error: "You can only rotate your own API key",
          requestId: req.requestId,
        });
      }

      const { key: newApiKey, prefix: newPrefix, hash: newHash } = generateApiKey();
      
      await storage.updateTenant(tenant.id, {
        apiKeyPrefix: newPrefix,
        apiKeyHash: newHash,
      });

      await storage.createAuditLog({
        tenantId: tenant.id,
        action: "apikey.rotated",
        resource: "tenant",
        resourceId: tenant.id,
        changes: { rotated: true },
      });

      res.json({
        success: true,
        apiKey: newApiKey,
        warning: "Save your new API key now. The old key is now invalid and cannot be recovered.",
        requestId: req.requestId,
      });
    } catch (error) {
      console.error("Rotate API key error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.patch("/api/admin/tenants/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const updates = req.body;
      
      if (updates.tier) {
        const tierLimits = TIER_LIMITS[updates.tier as keyof typeof TIER_LIMITS];
        if (tierLimits) {
          updates.allowedChains = tierLimits.chains;
          updates.maxAddresses = tierLimits.maxAddresses;
          updates.maxWebhooks = tierLimits.maxWebhooks;
          updates.maxVirtualAccounts = tierLimits.maxVirtualAccounts;
          updates.rateLimit = tierLimits.rateLimit;
          updates.monthlyQuota = tierLimits.monthlyQuota;
        }
      }

      const tenant = await storage.updateTenant(req.params.id, updates);
      if (!tenant) {
        return res.status(404).json({ success: false, error: "Tenant not found" });
      }

      await storage.createAuditLog({
        tenantId: tenant.id,
        action: "admin.tenant.updated",
        resource: "tenant",
        resourceId: tenant.id,
        changes: updates,
        ipAddress: req.ip,
      });

      res.json({ success: true, tenant, requestId: req.requestId });
    } catch (error) {
      console.error("Admin update tenant error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.post("/api/admin/tenants/:id/suspend", adminAuthMiddleware, async (req, res) => {
    try {
      const tenant = await storage.updateTenant(req.params.id, { status: "suspended" });
      if (!tenant) {
        return res.status(404).json({ success: false, error: "Tenant not found" });
      }

      await storage.createAuditLog({
        tenantId: tenant.id,
        action: "admin.tenant.suspended",
        resource: "tenant",
        resourceId: tenant.id,
        changes: { status: "suspended" },
        ipAddress: req.ip,
      });

      res.json({ success: true, message: "Tenant suspended", requestId: req.requestId });
    } catch (error) {
      console.error("Suspend tenant error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.post("/api/admin/tenants/:id/activate", adminAuthMiddleware, async (req, res) => {
    try {
      const tenant = await storage.updateTenant(req.params.id, { status: "active" });
      if (!tenant) {
        return res.status(404).json({ success: false, error: "Tenant not found" });
      }

      await storage.createAuditLog({
        tenantId: tenant.id,
        action: "admin.tenant.activated",
        resource: "tenant",
        resourceId: tenant.id,
        changes: { status: "active" },
        ipAddress: req.ip,
      });

      res.json({ success: true, message: "Tenant activated", requestId: req.requestId });
    } catch (error) {
      console.error("Activate tenant error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.post(
    "/api/v1/addresses",
    authMiddleware,
    rateLimitMiddleware,
    quotaMiddleware,
    chainAccessMiddleware,
    meterEndpoint("address_create"),
    async (req, res) => {
      try {
        const data = CreateAddressSchema.parse(req.body);
        const tenant = req.tenant!;

        const addressCount = await storage.countAddressesByTenant(tenant.id);
        if (tenant.maxAddresses !== -1 && addressCount >= tenant.maxAddresses) {
          return res.status(403).json({
            success: false,
            error: `Address limit reached (${tenant.maxAddresses})`,
            requestId: req.requestId,
            upgrade: true,
          });
        }

        const chainInfo = getChainInfo(data.chain);
        if (!chainInfo) {
          return res.status(400).json({
            success: false,
            error: `Unsupported chain: ${data.chain}`,
            requestId: req.requestId,
          });
        }

        const walletResult = await tatumClient.generateAddress(data.chain);
        
        if (!walletResult.success || !walletResult.data) {
          return res.status(502).json({
            success: false,
            error: walletResult.error || "Failed to generate address",
            requestId: req.requestId,
          });
        }

        const address = await storage.createAddress({
          tenantId: tenant.id,
          chain: data.chain,
          currency: chainInfo.symbol,
          address: walletResult.data.address,
          publicKey: walletResult.data.publicKey,
          label: data.label,
          tags: data.tags || [],
          webhookUrl: data.webhookUrl,
          status: "active",
          balance: "0",
          balanceUsd: "0",
        });

        await storage.createAuditLog({
          tenantId: tenant.id,
          action: "address.created",
          resource: "address",
          resourceId: address.id,
          changes: { chain: data.chain, address: address.address },
          requestId: req.requestId,
        });

        res.status(201).json({
          success: true,
          address: {
            id: address.id,
            chain: address.chain,
            currency: address.currency,
            address: address.address,
            label: address.label,
            tags: address.tags,
            status: address.status,
            createdAt: address.createdAt,
          },
        });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: error.errors,
            requestId: req.requestId,
          });
        }
        console.error("Create address error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/addresses",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const { chain, status, limit, offset } = req.query;
        
        const addresses = await storage.getAddressesByTenant(req.tenant!.id, {
          chain: chain as string,
          status: status as string,
          limit: parseInt(limit as string) || 50,
          offset: parseInt(offset as string) || 0,
        });

        const total = await storage.countAddressesByTenant(req.tenant!.id);

        res.json({
          success: true,
          addresses: addresses.map(a => ({
            id: a.id,
            chain: a.chain,
            currency: a.currency,
            address: a.address,
            label: a.label,
            tags: a.tags,
            status: a.status,
            balance: a.balance,
            balanceUsd: a.balanceUsd,
            lastSynced: a.lastSynced,
            createdAt: a.createdAt,
          })),
          pagination: {
            total,
            limit: parseInt(limit as string) || 50,
            offset: parseInt(offset as string) || 0,
          },
        });
      } catch (error) {
        console.error("Get addresses error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/addresses/:id",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const address = await storage.getAddress(req.params.id);
        
        if (!address || address.tenantId !== req.tenant!.id) {
          return res.status(404).json({
            success: false,
            error: "Address not found",
            requestId: req.requestId,
          });
        }

        res.json({ success: true, address });
      } catch (error) {
        console.error("Get address error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/addresses/:id/balance",
    authMiddleware,
    rateLimitMiddleware,
    quotaMiddleware,
    meterEndpoint("balance_query"),
    async (req, res) => {
      try {
        const address = await storage.getAddress(req.params.id);
        
        if (!address || address.tenantId !== req.tenant!.id) {
          return res.status(404).json({
            success: false,
            error: "Address not found",
            requestId: req.requestId,
          });
        }

        const balanceResult = await tatumClient.getBalance(address.chain, address.address);
        
        if (!balanceResult.success) {
          return res.status(502).json({
            success: false,
            error: balanceResult.error || "Failed to fetch balance",
            requestId: req.requestId,
          });
        }

        const rateResult = await tatumClient.getExchangeRates([address.currency]);
        const rate = rateResult.data?.[address.currency.toUpperCase()]?.usd || 0;
        const balanceValue = parseFloat(balanceResult.data?.balance || "0");
        const balanceUsd = (balanceValue * rate).toFixed(2);

        await storage.updateAddress(address.id, {
          balance: balanceResult.data?.balance || "0",
          balanceUsd,
          lastSynced: new Date(),
        });

        res.json({
          success: true,
          balance: {
            native: balanceResult.data?.balance || "0",
            usd: balanceUsd,
            currency: address.currency,
            tokens: balanceResult.data?.tokens || [],
            lastSynced: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Get balance error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.patch(
    "/api/v1/addresses/:id",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const address = await storage.getAddress(req.params.id);
        
        if (!address || address.tenantId !== req.tenant!.id) {
          return res.status(404).json({
            success: false,
            error: "Address not found",
            requestId: req.requestId,
          });
        }

        const { label, tags, webhookUrl, metadata } = req.body;
        const updates: any = {};
        if (label !== undefined) updates.label = label;
        if (tags !== undefined) updates.tags = tags;
        if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;
        if (metadata !== undefined) updates.metadata = metadata;

        const updated = await storage.updateAddress(req.params.id, updates);

        await storage.createAuditLog({
          tenantId: req.tenant!.id,
          action: "address.updated",
          resource: "address",
          resourceId: address.id,
          changes: updates,
          requestId: req.requestId,
        });

        res.json({ success: true, address: updated });
      } catch (error) {
        console.error("Update address error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.delete(
    "/api/v1/addresses/:id",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const address = await storage.getAddress(req.params.id);
        
        if (!address || address.tenantId !== req.tenant!.id) {
          return res.status(404).json({
            success: false,
            error: "Address not found",
            requestId: req.requestId,
          });
        }

        await storage.archiveAddress(req.params.id);

        await storage.createAuditLog({
          tenantId: req.tenant!.id,
          action: "address.archived",
          resource: "address",
          resourceId: address.id,
          requestId: req.requestId,
        });

        res.json({ success: true, message: "Address archived" });
      } catch (error) {
        console.error("Archive address error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/addresses/:id/tokens",
    authMiddleware,
    rateLimitMiddleware,
    quotaMiddleware,
    meterEndpoint("token_balance"),
    async (req, res) => {
      try {
        const address = await storage.getAddress(req.params.id);
        
        if (!address || address.tenantId !== req.tenant!.id) {
          return res.status(404).json({
            success: false,
            error: "Address not found",
            requestId: req.requestId,
          });
        }

        const tokensResult = await tatumClient.getTokens(address.chain, address.address);
        
        res.json({
          success: true,
          tokens: tokensResult.data || [],
        });
      } catch (error) {
        console.error("Get tokens error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/addresses/:id/nfts",
    authMiddleware,
    rateLimitMiddleware,
    quotaMiddleware,
    meterEndpoint("nft_metadata"),
    async (req, res) => {
      try {
        const address = await storage.getAddress(req.params.id);
        
        if (!address || address.tenantId !== req.tenant!.id) {
          return res.status(404).json({
            success: false,
            error: "Address not found",
            requestId: req.requestId,
          });
        }

        const nftsResult = await tatumClient.getNFTs(address.chain, address.address);
        
        res.json({
          success: true,
          nfts: nftsResult.data || [],
        });
      } catch (error) {
        console.error("Get NFTs error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/addresses/:id/transactions",
    authMiddleware,
    rateLimitMiddleware,
    quotaMiddleware,
    meterEndpoint("tx_history"),
    async (req, res) => {
      try {
        const address = await storage.getAddress(req.params.id);
        
        if (!address || address.tenantId !== req.tenant!.id) {
          return res.status(404).json({
            success: false,
            error: "Address not found",
            requestId: req.requestId,
          });
        }

        const { pageSize, offset } = req.query;
        const txResult = await tatumClient.getTransactionHistory(
          address.chain,
          address.address,
          {
            pageSize: parseInt(pageSize as string) || 50,
            offset: parseInt(offset as string) || 0,
          }
        );
        
        res.json({
          success: true,
          transactions: txResult.data || [],
        });
      } catch (error) {
        console.error("Get transactions error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/transactions/:chain/:hash",
    authMiddleware,
    rateLimitMiddleware,
    quotaMiddleware,
    chainAccessMiddleware,
    meterEndpoint("tx_history"),
    async (req, res) => {
      try {
        const { chain, hash } = req.params;
        const txResult = await tatumClient.getTransaction(chain, hash);
        
        if (!txResult.success) {
          return res.status(404).json({
            success: false,
            error: txResult.error || "Transaction not found",
            requestId: req.requestId,
          });
        }

        res.json({
          success: true,
          transaction: txResult.data,
        });
      } catch (error) {
        console.error("Get transaction error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/fees/:chain",
    authMiddleware,
    rateLimitMiddleware,
    chainAccessMiddleware,
    meterEndpoint("rpc_standard"),
    async (req, res) => {
      try {
        const feeResult = await tatumClient.estimateFee(req.params.chain);
        
        if (!feeResult.success) {
          return res.status(502).json({
            success: false,
            error: feeResult.error || "Failed to estimate fees",
            requestId: req.requestId,
          });
        }

        res.json({
          success: true,
          fees: feeResult.data,
          chain: req.params.chain,
        });
      } catch (error) {
        console.error("Get fees error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.post(
    "/api/v1/transactions/:chain/broadcast",
    authMiddleware,
    rateLimitMiddleware,
    quotaMiddleware,
    chainAccessMiddleware,
    meterEndpoint("tx_broadcast_eth"),
    async (req, res) => {
      try {
        const { txData } = req.body;
        
        if (!txData) {
          return res.status(400).json({
            success: false,
            error: "txData is required",
            requestId: req.requestId,
          });
        }

        const result = await tatumClient.broadcastTransaction(req.params.chain, txData);
        
        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: result.error || "Failed to broadcast transaction",
            requestId: req.requestId,
          });
        }

        await storage.createTransaction({
          tenantId: req.tenant!.id,
          txHash: result.data!.txId,
          chain: req.params.chain,
          amount: "0",
          currency: req.params.chain.toUpperCase(),
          status: "pending",
          type: "broadcast",
        });

        res.json({
          success: true,
          txId: result.data!.txId,
        });
      } catch (error) {
        console.error("Broadcast transaction error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/exchange-rates",
    authMiddleware,
    rateLimitMiddleware,
    meterEndpoint("exchange_rate"),
    async (req, res) => {
      try {
        const symbols = (req.query.symbols as string)?.split(",") || ["BTC", "ETH", "SOL"];
        const result = await tatumClient.getExchangeRates(symbols);
        
        res.json({
          success: true,
          rates: result.data || {},
        });
      } catch (error) {
        console.error("Get exchange rates error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/web3-names/:name",
    authMiddleware,
    rateLimitMiddleware,
    meterEndpoint("web3_resolve"),
    async (req, res) => {
      try {
        const result = await tatumClient.resolveWeb3Name(req.params.name);
        
        if (!result.success) {
          return res.status(404).json({
            success: false,
            error: result.error || "Name not found",
            requestId: req.requestId,
          });
        }

        res.json({
          success: true,
          name: req.params.name,
          address: result.data!.address,
        });
      } catch (error) {
        console.error("Resolve web3 name error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/security/address/:address",
    authMiddleware,
    rateLimitMiddleware,
    meterEndpoint("malicious_check"),
    async (req, res) => {
      try {
        const result = await tatumClient.checkMaliciousAddress(req.params.address);
        
        res.json({
          success: true,
          address: req.params.address,
          security: result.data || { isMalicious: false, riskScore: 0, labels: [] },
        });
      } catch (error) {
        console.error("Check address security error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.post(
    "/api/v1/webhooks",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const data = CreateWebhookSchema.parse(req.body);
        const tenant = req.tenant!;

        const webhookCount = await storage.countWebhooksByTenant(tenant.id);
        if (tenant.maxWebhooks !== -1 && webhookCount >= tenant.maxWebhooks) {
          return res.status(403).json({
            success: false,
            error: `Webhook limit reached (${tenant.maxWebhooks})`,
            requestId: req.requestId,
            upgrade: true,
          });
        }

        const webhook = await storage.createWebhook({
          tenantId: tenant.id,
          url: data.url,
          events: data.events,
          hmacSecret: generateHmacSecret(),
          active: true,
        });

        await storage.createAuditLog({
          tenantId: tenant.id,
          action: "webhook.created",
          resource: "webhook",
          resourceId: webhook.id,
          changes: { url: data.url, events: data.events },
          requestId: req.requestId,
        });

        res.status(201).json({
          success: true,
          webhook: {
            id: webhook.id,
            url: webhook.url,
            events: webhook.events,
            hmacSecret: webhook.hmacSecret,
            active: webhook.active,
            createdAt: webhook.createdAt,
          },
        });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: error.errors,
            requestId: req.requestId,
          });
        }
        console.error("Create webhook error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/webhooks",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const webhooks = await storage.getWebhooksByTenant(req.tenant!.id);
        
        res.json({
          success: true,
          webhooks: webhooks.map(w => ({
            id: w.id,
            url: w.url,
            events: w.events,
            active: w.active,
            lastTriggered: w.lastTriggered,
            lastStatus: w.lastStatus,
            retryCount: w.retryCount,
            createdAt: w.createdAt,
          })),
        });
      } catch (error) {
        console.error("Get webhooks error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.delete(
    "/api/v1/webhooks/:id",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const webhook = await storage.getWebhook(req.params.id);
        
        if (!webhook || webhook.tenantId !== req.tenant!.id) {
          return res.status(404).json({
            success: false,
            error: "Webhook not found",
            requestId: req.requestId,
          });
        }

        await storage.deleteWebhook(req.params.id);

        await storage.createAuditLog({
          tenantId: req.tenant!.id,
          action: "webhook.deleted",
          resource: "webhook",
          resourceId: webhook.id,
          requestId: req.requestId,
        });

        res.json({ success: true, message: "Webhook deleted" });
      } catch (error) {
        console.error("Delete webhook error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/usage",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        
        const start = startDate 
          ? new Date(startDate as string)
          : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate
          ? new Date(endDate as string)
          : new Date();

        const stats = await storage.getApiUsageStats(req.tenant!.id, start, end);
        const quota = await checkQuota(req.tenant!.id, req.tenant!.monthlyQuota);

        res.json({
          success: true,
          usage: {
            period: {
              start: start.toISOString(),
              end: end.toISOString(),
            },
            ...stats,
            costUsd: stats.totalCredits.toFixed(4),
            quota: {
              used: quota.used,
              remaining: quota.remaining,
              percentUsed: Math.round(quota.percentUsed),
              limit: req.tenant!.monthlyQuota,
            },
          },
        });
      } catch (error) {
        console.error("Get usage error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get(
    "/api/v1/audit-logs",
    authMiddleware,
    rateLimitMiddleware,
    tierCheckMiddleware(),
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const logs = await storage.getAuditLogsByTenant(req.tenant!.id, limit);

        res.json({
          success: true,
          logs: logs.map(l => ({
            id: l.id,
            action: l.action,
            resource: l.resource,
            resourceId: l.resourceId,
            changes: l.changes,
            ipAddress: l.ipAddress,
            timestamp: l.timestamp,
          })),
        });
      } catch (error) {
        console.error("Get audit logs error:", error);
        res.status(500).json({ success: false, error: "Internal server error", requestId: req.requestId });
      }
    }
  );

  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      
      let totalRequests = 0;
      let totalRevenue = 0;
      let totalAddresses = 0;
      
      const tierBreakdown: Record<string, number> = { starter: 0, scale: 0, enterprise: 0 };
      const chainUsage: Record<string, number> = {};

      for (const tenant of tenants) {
        const usage = await getMonthlyUsage(tenant.id);
        totalRequests += usage.totalRequests;
        totalRevenue += usage.costUsd;
        totalAddresses += await storage.countAddressesByTenant(tenant.id);
        tierBreakdown[tenant.tier] = (tierBreakdown[tenant.tier] || 0) + 1;
      }

      res.json({
        success: true,
        stats: {
          totalTenants: tenants.length,
          activeTenants: tenants.filter(t => t.status === "active").length,
          totalRequests,
          totalRevenue: totalRevenue.toFixed(2),
          totalAddresses,
          tierBreakdown,
          chainUsage,
        },
      });
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ============================================================
  // CRYPTO GATEWAY API ENDPOINTS
  // ============================================================

  const InternalSwapSchema = z.object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    assetName: z.string(),
    blockchain: z.string(),
    fromAmount: z.string(),
    toAmount: z.string(),
    rate: z.number().positive(),
  });

  const ExternalWithdrawSchema = z.object({
    fromAccountId: z.string().uuid(),
    toExternalAddress: z.string().min(20),
    assetName: z.string(),
    blockchain: z.string(),
    amount: z.string(),
  });

  // Create Virtual Account
  app.post(
    "/api/v1/gateway/virtual-accounts",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const { accountType = "crypto" } = req.body;
        
        const vaCount = await storage.countVirtualAccountsByTenant(req.tenant!.id);
        if (req.tenant!.maxVirtualAccounts !== -1 && vaCount >= req.tenant!.maxVirtualAccounts) {
          return res.status(403).json({
            success: false,
            error: `Virtual account limit reached (${req.tenant!.maxVirtualAccounts})`,
            upgrade: true,
            requestId: req.requestId,
          });
        }

        const { cryptoGateway } = await import("./lib/crypto-gateway");
        const account = await cryptoGateway.createVirtualAccount(req.tenant!.id, accountType);

        await storage.createAuditLog({
          tenantId: req.tenant!.id,
          action: "virtual_account.created",
          resource: "virtual_account",
          resourceId: account.id,
          changes: { accountType },
          requestId: req.requestId,
        });

        res.status(201).json({
          success: true,
          virtualAccount: {
            id: account.id,
            accountType: account.accountType,
            balances: account.balances,
            status: account.status,
            createdAt: account.createdAt,
          },
          requestId: req.requestId,
        });
      } catch (error: any) {
        console.error("Create virtual account error:", error);
        res.status(500).json({ success: false, error: error.message, requestId: req.requestId });
      }
    }
  );

  // Get Virtual Accounts
  app.get(
    "/api/v1/gateway/virtual-accounts",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const accounts = await storage.getVirtualAccountsByTenant(req.tenant!.id);
        
        res.json({
          success: true,
          virtualAccounts: accounts.map(a => ({
            id: a.id,
            accountType: a.accountType,
            balances: typeof a.balances === 'string' ? JSON.parse(a.balances) : a.balances,
            status: a.status,
            frozen: a.frozen,
            createdAt: a.createdAt,
          })),
          requestId: req.requestId,
        });
      } catch (error: any) {
        console.error("Get virtual accounts error:", error);
        res.status(500).json({ success: false, error: error.message, requestId: req.requestId });
      }
    }
  );

  // Get Virtual Account Balance
  app.get(
    "/api/v1/gateway/virtual-accounts/:id/balance",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const { cryptoGateway } = await import("./lib/crypto-gateway");
        const balance = await cryptoGateway.getVirtualAccountBalance(req.params.id);

        res.json({
          success: true,
          balance,
          requestId: req.requestId,
        });
      } catch (error: any) {
        console.error("Get virtual account balance error:", error);
        res.status(500).json({ success: false, error: error.message, requestId: req.requestId });
      }
    }
  );

  // Internal Swap (Zero gas, 0.5% commission)
  app.post(
    "/api/v1/gateway/swap",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const data = InternalSwapSchema.parse(req.body);
        const { cryptoGateway } = await import("./lib/crypto-gateway");

        const result = await cryptoGateway.internalSwap({
          tenantId: req.tenant!.id,
          scenario: "scenario1",
          ...data,
        });

        await storage.createAuditLog({
          tenantId: req.tenant!.id,
          action: "internal_swap.executed",
          resource: "crypto_transaction",
          resourceId: result.txId,
          changes: {
            fromAmount: data.fromAmount,
            toAmount: data.toAmount,
            commission: result.commission,
          },
          requestId: req.requestId,
        });

        res.json({
          success: true,
          swap: result,
          message: "Internal swap completed - zero gas fees, 0.5% commission applied",
          requestId: req.requestId,
        });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: error.errors,
            requestId: req.requestId,
          });
        }
        console.error("Internal swap error:", error);
        res.status(500).json({ success: false, error: error.message, requestId: req.requestId });
      }
    }
  );

  // External Withdraw (with gas markup)
  app.post(
    "/api/v1/gateway/withdraw",
    authMiddleware,
    rateLimitMiddleware,
    async (req, res) => {
      try {
        const data = ExternalWithdrawSchema.parse(req.body);
        const { cryptoGateway } = await import("./lib/crypto-gateway");

        const result = await cryptoGateway.externalWithdraw({
          tenantId: req.tenant!.id,
          scenario: "scenario1",
          ...data,
        });

        await storage.createAuditLog({
          tenantId: req.tenant!.id,
          action: "external_withdraw.initiated",
          resource: "crypto_transaction",
          resourceId: result.txId,
          changes: {
            amount: data.amount,
            toAddress: data.toExternalAddress,
            gasCharged: result.gasCharged,
            gasProfit: result.yourProfit,
          },
          requestId: req.requestId,
        });

        res.json({
          success: true,
          withdraw: result,
          message: "External withdrawal initiated with gas markup applied",
          requestId: req.requestId,
        });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: error.errors,
            requestId: req.requestId,
          });
        }
        console.error("External withdraw error:", error);
        res.status(500).json({ success: false, error: error.message, requestId: req.requestId });
      }
    }
  );

  // ============================================================
  // ADMIN API ENDPOINTS (Gas Configuration & Revenue)
  // ============================================================

  // Get Gas Settings
  app.get("/api/admin/gas-settings", adminAuthMiddleware, async (req, res) => {
    try {
      const { gasFeeManager } = await import("./lib/gas-fees");
      const config = await gasFeeManager.loadConfig();

      res.json({
        success: true,
        gasSettings: config,
        requestId: req.requestId,
      });
    } catch (error: any) {
      console.error("Get gas settings error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Update Global Gas Markup
  app.put("/api/admin/gas-settings/global", adminAuthMiddleware, async (req, res) => {
    try {
      const { markup } = req.body;
      if (typeof markup !== "number" || markup < 10 || markup > 100) {
        return res.status(400).json({
          success: false,
          error: "Markup must be a number between 10 and 100",
        });
      }

      const { gasFeeManager } = await import("./lib/gas-fees");
      await gasFeeManager.updateGlobalMarkup(markup, "admin");

      res.json({
        success: true,
        message: `Global gas markup updated to ${markup}%`,
        newMarkup: markup,
        requestId: req.requestId,
      });
    } catch (error: any) {
      console.error("Update gas markup error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Set Client-Specific Gas Markup
  app.put("/api/admin/gas-settings/client/:clientId", adminAuthMiddleware, async (req, res) => {
    try {
      const { markup, reason, expiresAt } = req.body;
      if (typeof markup !== "number" || markup < 10 || markup > 100) {
        return res.status(400).json({
          success: false,
          error: "Markup must be a number between 10 and 100",
        });
      }

      const { gasFeeManager } = await import("./lib/gas-fees");
      await gasFeeManager.setClientMarkup(
        req.params.clientId,
        markup,
        reason || "Admin override",
        "admin",
        expiresAt ? new Date(expiresAt) : undefined
      );

      res.json({
        success: true,
        message: `Client ${req.params.clientId} gas markup set to ${markup}%`,
        clientId: req.params.clientId,
        newMarkup: markup,
        requestId: req.requestId,
      });
    } catch (error: any) {
      console.error("Set client gas markup error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Remove Client-Specific Gas Markup
  app.delete("/api/admin/gas-settings/client/:clientId", adminAuthMiddleware, async (req, res) => {
    try {
      const { gasFeeManager } = await import("./lib/gas-fees");
      await gasFeeManager.removeClientMarkup(req.params.clientId, "admin");

      res.json({
        success: true,
        message: `Client ${req.params.clientId} gas markup removed, now using global default`,
        requestId: req.requestId,
      });
    } catch (error: any) {
      console.error("Remove client gas markup error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get Revenue Metrics
  app.get("/api/admin/revenue", adminAuthMiddleware, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { cryptoTransactions } = await import("@shared/schema");
      const { sql, desc } = await import("drizzle-orm");

      // Get all completed transactions with commissions
      const transactions = await db
        .select()
        .from(cryptoTransactions)
        .orderBy(desc(cryptoTransactions.createdAt))
        .limit(1000);

      // Calculate revenue metrics
      let totalSwapCommissions = 0;
      let totalGasMarkupRevenue = 0;
      let totalTransactions = transactions.length;
      let totalVolume = 0;

      const revenueByType: Record<string, number> = {
        internal_swap: 0,
        external_withdraw: 0,
        external_deposit: 0,
      };

      const revenueByBlockchain: Record<string, number> = {};
      const volumeByAsset: Record<string, number> = {};

      for (const tx of transactions) {
        const amount = parseFloat(tx.amount || "0");
        const commission = parseFloat(tx.commissionAmount || "0");
        const gasProfit = parseFloat(tx.gasCharged || "0") - parseFloat(tx.gasReal || "0");

        totalVolume += amount;
        
        if (tx.type === "internal_swap") {
          totalSwapCommissions += commission;
          revenueByType.internal_swap += commission;
        } else if (tx.type === "external_withdraw") {
          totalGasMarkupRevenue += gasProfit > 0 ? gasProfit : 0;
          revenueByType.external_withdraw += gasProfit > 0 ? gasProfit : 0;
        }

        // By blockchain
        revenueByBlockchain[tx.blockchain] = (revenueByBlockchain[tx.blockchain] || 0) + commission + (gasProfit > 0 ? gasProfit : 0);

        // By asset
        volumeByAsset[tx.assetName] = (volumeByAsset[tx.assetName] || 0) + amount;
      }

      const totalRevenue = totalSwapCommissions + totalGasMarkupRevenue;

      res.json({
        success: true,
        revenue: {
          total: {
            allTime: totalRevenue.toFixed(8),
            swapCommissions: totalSwapCommissions.toFixed(8),
            gasMarkupRevenue: totalGasMarkupRevenue.toFixed(8),
          },
          transactions: {
            total: totalTransactions,
            volume: totalVolume.toFixed(8),
          },
          breakdown: {
            byType: revenueByType,
            byBlockchain: revenueByBlockchain,
            volumeByAsset,
          },
          rates: {
            swapCommissionRate: "0.5%",
            defaultGasMarkup: "40%",
          },
        },
        requestId: req.requestId,
      });
    } catch (error: any) {
      console.error("Get revenue metrics error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get Recent Transactions (Admin view)
  app.get("/api/admin/transactions", adminAuthMiddleware, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { cryptoTransactions } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");

      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await db
        .select()
        .from(cryptoTransactions)
        .orderBy(desc(cryptoTransactions.createdAt))
        .limit(limit);

      res.json({
        success: true,
        transactions: transactions.map(tx => ({
          id: tx.id,
          tenantId: tx.tenantId,
          type: tx.type,
          scenario: tx.scenario,
          assetName: tx.assetName,
          blockchain: tx.blockchain,
          amount: tx.amount,
          gasReal: tx.gasReal,
          gasCharged: tx.gasCharged,
          commissionAmount: tx.commissionAmount,
          status: tx.status,
          txHash: tx.txHash,
          createdAt: tx.createdAt,
        })),
        requestId: req.requestId,
      });
    } catch (error: any) {
      console.error("Get admin transactions error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
