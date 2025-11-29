import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const TierEnum = z.enum(["starter", "scale", "enterprise"]);
export type Tier = z.infer<typeof TierEnum>;

export const StatusEnum = z.enum(["active", "suspended", "deleted"]);
export type Status = z.infer<typeof StatusEnum>;

export const ChainEnum = z.enum([
  "bitcoin", "ethereum", "solana", "polygon", "tron", "bsc", 
  "ripple", "cardano", "near", "polkadot", "avalanche", "arbitrum",
  "optimism", "base", "fantom", "cronos", "cosmos", "algorand"
]);
export type Chain = z.infer<typeof ChainEnum>;

export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  tier: text("tier").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  apiKeyPrefix: varchar("api_key_prefix", { length: 16 }).notNull(),
  apiKeyHash: text("api_key_hash").notNull().unique(),
  hmacSecret: text("hmac_secret").notNull(),
  allowedChains: text("allowed_chains").array().notNull().default(sql`ARRAY['bitcoin', 'ethereum', 'solana']`),
  maxAddresses: integer("max_addresses").notNull().default(50),
  maxWebhooks: integer("max_webhooks").notNull().default(1),
  maxVirtualAccounts: integer("max_virtual_accounts").notNull().default(0),
  rateLimit: integer("rate_limit").notNull().default(10),
  monthlyQuota: integer("monthly_quota").notNull().default(10000),
  billingEmail: text("billing_email"),
  companyName: text("company_name"),
  website: text("website"),
  ipWhitelist: text("ip_whitelist").array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("tenants_email_idx").on(table.email),
  index("tenants_api_key_hash_idx").on(table.apiKeyHash),
  index("tenants_status_idx").on(table.status),
]);

export const addresses = pgTable("addresses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  chain: text("chain").notNull(),
  currency: text("currency").notNull(),
  address: text("address").notNull(),
  publicKey: text("public_key"),
  derivationPath: text("derivation_path"),
  label: text("label"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("active"),
  balance: text("balance").default("0"),
  balanceUsd: text("balance_usd").default("0"),
  lastSynced: timestamp("last_synced"),
  webhookUrl: text("webhook_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("addresses_tenant_idx").on(table.tenantId),
  index("addresses_chain_idx").on(table.chain),
  index("addresses_status_idx").on(table.status),
  index("addresses_address_idx").on(table.address),
]);

export const transactions = pgTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  txHash: text("tx_hash").notNull(),
  chain: text("chain").notNull(),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  amount: text("amount").notNull(),
  currency: text("currency").notNull(),
  fee: text("fee"),
  feeUsd: text("fee_usd"),
  status: text("status").notNull().default("pending"),
  type: text("type").notNull().default("native"),
  blockNumber: integer("block_number"),
  confirmations: integer("confirmations").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("transactions_tenant_idx").on(table.tenantId),
  index("transactions_chain_idx").on(table.chain),
  index("transactions_hash_idx").on(table.txHash),
  index("transactions_status_idx").on(table.status),
]);

export const webhooks = pgTable("webhooks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  hmacSecret: text("hmac_secret").notNull(),
  active: boolean("active").default(true),
  retryCount: integer("retry_count").default(0),
  lastTriggered: timestamp("last_triggered"),
  lastStatus: integer("last_status"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("webhooks_tenant_idx").on(table.tenantId),
  index("webhooks_active_idx").on(table.active),
]);

export const virtualAccounts = pgTable("virtual_accounts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: text("customer_id"),
  currency: text("currency").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  balance: text("balance").default("0"),
  depositAddresses: text("deposit_addresses").array().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("active"),
  frozen: boolean("frozen").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("virtual_accounts_tenant_idx").on(table.tenantId),
  index("virtual_accounts_customer_idx").on(table.customerId),
]);

export const apiUsage = pgTable("api_usage", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  chain: text("chain"),
  action: text("action").notNull(),
  units: real("units").notNull(),
  credits: real("credits").notNull(),
  statusCode: integer("status_code").notNull(),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  responseTimeMs: integer("response_time_ms"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("api_usage_tenant_idx").on(table.tenantId),
  index("api_usage_timestamp_idx").on(table.timestamp),
  index("api_usage_action_idx").on(table.action),
]);

export const billingAggregations = pgTable("billing_aggregations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  periodType: text("period_type").notNull().default("daily"),
  totalUnits: real("total_units").notNull().default(0),
  totalCredits: real("total_credits").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  breakdown: jsonb("breakdown"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("billing_tenant_period_idx").on(table.tenantId, table.period),
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "set null" }),
  userId: text("user_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  changes: jsonb("changes"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestId: varchar("request_id", { length: 36 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("audit_logs_tenant_idx").on(table.tenantId),
  index("audit_logs_timestamp_idx").on(table.timestamp),
  index("audit_logs_action_idx").on(table.action),
]);

export const tenantsRelations = relations(tenants, ({ many }) => ({
  addresses: many(addresses),
  transactions: many(transactions),
  webhooks: many(webhooks),
  virtualAccounts: many(virtualAccounts),
  apiUsage: many(apiUsage),
  billingAggregations: many(billingAggregations),
  auditLogs: many(auditLogs),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  tenant: one(tenants, {
    fields: [addresses.tenantId],
    references: [tenants.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [transactions.tenantId],
    references: [tenants.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhooks.tenantId],
    references: [tenants.id],
  }),
}));

export const virtualAccountsRelations = relations(virtualAccounts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [virtualAccounts.tenantId],
    references: [tenants.id],
  }),
}));

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  tenant: one(tenants, {
    fields: [apiUsage.tenantId],
    references: [tenants.id],
  }),
}));

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAddressSchema = createInsertSchema(addresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  createdAt: true,
});

export const insertVirtualAccountSchema = createInsertSchema(virtualAccounts).omit({
  id: true,
  createdAt: true,
});

export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({
  id: true,
  timestamp: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Address = typeof addresses.$inferSelect;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type VirtualAccount = typeof virtualAccounts.$inferSelect;
export type InsertVirtualAccount = z.infer<typeof insertVirtualAccountSchema>;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type InsertApiUsage = z.infer<typeof insertApiUsageSchema>;
export type BillingAggregation = typeof billingAggregations.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export const TIER_LIMITS = {
  starter: {
    chains: ["bitcoin", "ethereum", "solana"],
    maxAddresses: 50,
    maxWebhooks: 1,
    maxVirtualAccounts: 0,
    rateLimit: 10,
    monthlyQuota: 10000,
    kmsAllowed: false,
    archivalAccess: false,
    retentionDays: 1,
  },
  scale: {
    chains: ["bitcoin", "ethereum", "solana", "polygon", "tron", "bsc", "ripple", "cardano"],
    maxAddresses: 1000,
    maxWebhooks: 10,
    maxVirtualAccounts: 5,
    rateLimit: 100,
    monthlyQuota: 100000,
    kmsAllowed: true,
    archivalAccess: false,
    retentionDays: 7,
  },
  enterprise: {
    chains: ["bitcoin", "ethereum", "solana", "polygon", "tron", "bsc", "ripple", "cardano", "near", "polkadot", "avalanche", "arbitrum", "optimism", "base", "fantom", "cronos", "cosmos", "algorand"],
    maxAddresses: -1,
    maxWebhooks: -1,
    maxVirtualAccounts: 50,
    rateLimit: 1000,
    monthlyQuota: -1,
    kmsAllowed: true,
    archivalAccess: true,
    retentionDays: 30,
  },
} as const;

export const PRICING = {
  address_create: { units: 1, cost: 0.001 },
  balance_query: { units: 0.5, cost: 0.0005 },
  token_balance: { units: 1, cost: 0.001 },
  nft_metadata: { units: 2, cost: 0.002 },
  tx_broadcast_btc: { units: 50, cost: 0.05 },
  tx_broadcast_eth: { units: 10, cost: 0.01 },
  tx_broadcast_other: { units: 10, cost: 0.01 },
  tx_history: { units: 2, cost: 0.002 },
  webhook_subscription: { units: 0.02, cost: 0.02 },
  va_create: { units: 100, cost: 0.10 },
  va_transfer: { units: 5, cost: 0.005 },
  exchange_rate: { units: 0.1, cost: 0.0001 },
  web3_resolve: { units: 1, cost: 0.001 },
  malicious_check: { units: 2, cost: 0.002 },
  rpc_standard: { units: 2, cost: 0.0002 },
  rpc_eth_call: { units: 5, cost: 0.0005 },
  rpc_debug: { units: 50, cost: 0.005 },
} as const;

export const WEBHOOK_EVENTS = [
  "ADDRESS_TRANSACTION",
  "ADDRESS_BALANCE",
  "INCOMING_NATIVE_TX",
  "OUTGOING_NATIVE_TX",
  "INCOMING_FUNGIBLE_TX",
  "OUTGOING_FUNGIBLE_TX",
  "INCOMING_NFT_TX",
  "OUTGOING_NFT_TX",
  "INCOMING_MULTITOKEN_TX",
  "OUTGOING_MULTITOKEN_TX",
  "FAILED_TX",
  "PAID_FEE",
  "CONTRACT_LOG_EVENT",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export const SUPPORTED_CHAINS = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", icon: "₿" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "Ξ" },
  { id: "solana", name: "Solana", symbol: "SOL", icon: "◎" },
  { id: "polygon", name: "Polygon", symbol: "MATIC", icon: "⬡" },
  { id: "tron", name: "Tron", symbol: "TRX", icon: "♦" },
  { id: "bsc", name: "BNB Chain", symbol: "BNB", icon: "◆" },
  { id: "ripple", name: "XRP Ledger", symbol: "XRP", icon: "✕" },
  { id: "cardano", name: "Cardano", symbol: "ADA", icon: "₳" },
  { id: "near", name: "NEAR", symbol: "NEAR", icon: "Ⓝ" },
  { id: "polkadot", name: "Polkadot", symbol: "DOT", icon: "●" },
  { id: "avalanche", name: "Avalanche", symbol: "AVAX", icon: "▲" },
  { id: "arbitrum", name: "Arbitrum", symbol: "ARB", icon: "◈" },
  { id: "optimism", name: "Optimism", symbol: "OP", icon: "⊕" },
  { id: "base", name: "Base", symbol: "ETH", icon: "◯" },
  { id: "fantom", name: "Fantom", symbol: "FTM", icon: "◇" },
  { id: "cronos", name: "Cronos", symbol: "CRO", icon: "◎" },
  { id: "cosmos", name: "Cosmos", symbol: "ATOM", icon: "⚛" },
  { id: "algorand", name: "Algorand", symbol: "ALGO", icon: "Ⓐ" },
] as const;
