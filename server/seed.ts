import { storage } from "./storage";
import { generateApiKey, generateHmacSecret } from "./lib/auth";
import { TIER_LIMITS } from "@shared/schema";

export async function seedDemoData() {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_DEMO_DATA) {
    return null;
  }

  console.log("Checking for demo tenant...");
  
  const existingDemo = await storage.getTenantByEmail("demo@tatum-gateway.io");
  
  if (existingDemo) {
    console.log("Demo tenant already exists");
    return existingDemo;
  }

  console.log("Creating demo tenant...");
  
  const { prefix: apiKeyPrefix, hash: apiKeyHash } = generateApiKey();
  const tierLimits = TIER_LIMITS.scale;
  
  const demoTenant = await storage.createTenant({
    name: "Demo Account",
    email: "demo@tatum-gateway.io",
    tier: "scale",
    status: "active",
    apiKeyPrefix,
    apiKeyHash,
    hmacSecret: generateHmacSecret(),
    allowedChains: [...(tierLimits.chains as readonly string[])],
    maxAddresses: tierLimits.maxAddresses,
    maxWebhooks: tierLimits.maxWebhooks,
    maxVirtualAccounts: tierLimits.maxVirtualAccounts,
    rateLimit: tierLimits.rateLimit,
    monthlyQuota: tierLimits.monthlyQuota,
    companyName: "Tatum Gateway Demo",
    website: "https://tatum.io",
  });

  console.log("Demo tenant created:", demoTenant.id);

  await storage.createAuditLog({
    tenantId: demoTenant.id,
    action: "tenant.created",
    resource: "tenant",
    resourceId: demoTenant.id,
    changes: { tier: "scale", source: "seed" },
  });

  for (let i = 0; i < 10; i++) {
    await storage.recordApiUsage({
      tenantId: demoTenant.id,
      endpoint: `/api/v1/${["addresses", "balances", "tokens", "transactions"][i % 4]}`,
      method: ["GET", "POST"][i % 2],
      chain: ["ethereum", "bitcoin", "solana", "polygon"][i % 4],
      action: ["balance_query", "address_create", "token_balance", "tx_history"][i % 4],
      units: [0.5, 1, 1, 2][i % 4],
      credits: [0.0005, 0.001, 0.001, 0.002][i % 4],
      statusCode: 200,
      requestId: `demo_${i}`,
      responseTimeMs: 50 + Math.floor(Math.random() * 100),
    });
  }

  console.log("Demo usage data seeded!");

  return demoTenant;
}
