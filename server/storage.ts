import { 
  tenants, addresses, transactions, webhooks, virtualAccounts, 
  apiUsage, billingAggregations, auditLogs,
  type Tenant, type InsertTenant,
  type Address, type InsertAddress,
  type Transaction, type InsertTransaction,
  type Webhook, type InsertWebhook,
  type VirtualAccount, type InsertVirtualAccount,
  type ApiUsage, type InsertApiUsage,
  type BillingAggregation,
  type AuditLog, type InsertAuditLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte, like, inArray, ilike } from "drizzle-orm";

export interface IStorage {
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByApiKeyHash(apiKeyHash: string): Promise<Tenant | undefined>;
  getTenantByEmail(email: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<void>;

  getAddress(id: string): Promise<Address | undefined>;
  getAddressByAddress(tenantId: string, chain: string, address: string): Promise<Address | undefined>;
  getAddressesByTenant(tenantId: string, filters?: { chain?: string; status?: string; limit?: number; offset?: number }): Promise<Address[]>;
  countAddressesByTenant(tenantId: string): Promise<number>;
  createAddress(address: InsertAddress): Promise<Address>;
  updateAddress(id: string, updates: Partial<InsertAddress>): Promise<Address | undefined>;
  archiveAddress(id: string): Promise<void>;

  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByHash(chain: string, txHash: string): Promise<Transaction | undefined>;
  getTransactionsByTenant(tenantId: string, filters?: { chain?: string; status?: string; limit?: number; offset?: number }): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<InsertTransaction>): Promise<Transaction | undefined>;

  getWebhook(id: string): Promise<Webhook | undefined>;
  getWebhooksByTenant(tenantId: string): Promise<Webhook[]>;
  countWebhooksByTenant(tenantId: string): Promise<number>;
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  updateWebhook(id: string, updates: Partial<InsertWebhook>): Promise<Webhook | undefined>;
  deleteWebhook(id: string): Promise<void>;

  getVirtualAccount(id: string): Promise<VirtualAccount | undefined>;
  getVirtualAccountsByTenant(tenantId: string): Promise<VirtualAccount[]>;
  countVirtualAccountsByTenant(tenantId: string): Promise<number>;
  createVirtualAccount(va: InsertVirtualAccount): Promise<VirtualAccount>;
  updateVirtualAccount(id: string, updates: Partial<InsertVirtualAccount>): Promise<VirtualAccount | undefined>;

  recordApiUsage(usage: InsertApiUsage): Promise<ApiUsage>;
  getApiUsageByTenant(tenantId: string, startDate: Date, endDate: Date): Promise<ApiUsage[]>;
  getApiUsageStats(tenantId: string, startDate: Date, endDate: Date): Promise<{
    totalRequests: number;
    totalUnits: number;
    totalCredits: number;
    byEndpoint: Record<string, number>;
    byChain: Record<string, number>;
  }>;

  getBillingAggregation(tenantId: string, period: string): Promise<BillingAggregation | undefined>;
  upsertBillingAggregation(data: Omit<BillingAggregation, 'id' | 'createdAt'>): Promise<BillingAggregation>;

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByTenant(tenantId: string, limit?: number): Promise<AuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getTenantByApiKeyHash(apiKeyHash: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.apiKeyHash, apiKeyHash));
    return tenant || undefined;
  }

  async getTenantByEmail(email: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.email, email));
    return tenant || undefined;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTenant(id: string): Promise<void> {
    await db.update(tenants)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(tenants.id, id));
  }

  async getAddress(id: string): Promise<Address | undefined> {
    const [address] = await db.select().from(addresses).where(eq(addresses.id, id));
    return address || undefined;
  }

  async getAddressByAddress(tenantId: string, chain: string, address: string): Promise<Address | undefined> {
    const [result] = await db.select().from(addresses)
      .where(and(
        eq(addresses.tenantId, tenantId),
        eq(addresses.chain, chain),
        eq(addresses.address, address)
      ));
    return result || undefined;
  }

  async getAddressesByTenant(tenantId: string, filters?: { chain?: string; status?: string; limit?: number; offset?: number }): Promise<Address[]> {
    let query = db.select().from(addresses).where(eq(addresses.tenantId, tenantId));
    
    const conditions = [eq(addresses.tenantId, tenantId)];
    if (filters?.chain) conditions.push(eq(addresses.chain, filters.chain));
    if (filters?.status) conditions.push(eq(addresses.status, filters.status));

    return db.select()
      .from(addresses)
      .where(and(...conditions))
      .orderBy(desc(addresses.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
  }

  async countAddressesByTenant(tenantId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(addresses)
      .where(and(eq(addresses.tenantId, tenantId), eq(addresses.status, "active")));
    return result?.count || 0;
  }

  async createAddress(address: InsertAddress): Promise<Address> {
    const [created] = await db.insert(addresses).values(address).returning();
    return created;
  }

  async updateAddress(id: string, updates: Partial<InsertAddress>): Promise<Address | undefined> {
    const [updated] = await db.update(addresses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(addresses.id, id))
      .returning();
    return updated || undefined;
  }

  async archiveAddress(id: string): Promise<void> {
    await db.update(addresses)
      .set({ status: "archived", deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(addresses.id, id));
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx || undefined;
  }

  async getTransactionByHash(chain: string, txHash: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions)
      .where(and(eq(transactions.chain, chain), eq(transactions.txHash, txHash)));
    return tx || undefined;
  }

  async getTransactionsByTenant(tenantId: string, filters?: { chain?: string; status?: string; limit?: number; offset?: number }): Promise<Transaction[]> {
    const conditions = [eq(transactions.tenantId, tenantId)];
    if (filters?.chain) conditions.push(eq(transactions.chain, filters.chain));
    if (filters?.status) conditions.push(eq(transactions.status, filters.status));

    return db.select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  async updateTransaction(id: string, updates: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [updated] = await db.update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning();
    return updated || undefined;
  }

  async getWebhook(id: string): Promise<Webhook | undefined> {
    const [wh] = await db.select().from(webhooks).where(eq(webhooks.id, id));
    return wh || undefined;
  }

  async getWebhooksByTenant(tenantId: string): Promise<Webhook[]> {
    return db.select().from(webhooks)
      .where(eq(webhooks.tenantId, tenantId))
      .orderBy(desc(webhooks.createdAt));
  }

  async countWebhooksByTenant(tenantId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(webhooks)
      .where(and(eq(webhooks.tenantId, tenantId), eq(webhooks.active, true)));
    return result?.count || 0;
  }

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [created] = await db.insert(webhooks).values(webhook).returning();
    return created;
  }

  async updateWebhook(id: string, updates: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const [updated] = await db.update(webhooks)
      .set(updates)
      .where(eq(webhooks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteWebhook(id: string): Promise<void> {
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async getVirtualAccount(id: string): Promise<VirtualAccount | undefined> {
    const [va] = await db.select().from(virtualAccounts).where(eq(virtualAccounts.id, id));
    return va || undefined;
  }

  async getVirtualAccountsByTenant(tenantId: string): Promise<VirtualAccount[]> {
    return db.select().from(virtualAccounts)
      .where(eq(virtualAccounts.tenantId, tenantId))
      .orderBy(desc(virtualAccounts.createdAt));
  }

  async countVirtualAccountsByTenant(tenantId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(virtualAccounts)
      .where(and(eq(virtualAccounts.tenantId, tenantId), eq(virtualAccounts.status, "active")));
    return result?.count || 0;
  }

  async createVirtualAccount(va: InsertVirtualAccount): Promise<VirtualAccount> {
    const [created] = await db.insert(virtualAccounts).values(va).returning();
    return created;
  }

  async updateVirtualAccount(id: string, updates: Partial<InsertVirtualAccount>): Promise<VirtualAccount | undefined> {
    const [updated] = await db.update(virtualAccounts)
      .set(updates)
      .where(eq(virtualAccounts.id, id))
      .returning();
    return updated || undefined;
  }

  async recordApiUsage(usage: InsertApiUsage): Promise<ApiUsage> {
    const [created] = await db.insert(apiUsage).values(usage).returning();
    return created;
  }

  async getApiUsageByTenant(tenantId: string, startDate: Date, endDate: Date): Promise<ApiUsage[]> {
    return db.select().from(apiUsage)
      .where(and(
        eq(apiUsage.tenantId, tenantId),
        gte(apiUsage.timestamp, startDate),
        lte(apiUsage.timestamp, endDate)
      ))
      .orderBy(desc(apiUsage.timestamp));
  }

  async getApiUsageStats(tenantId: string, startDate: Date, endDate: Date): Promise<{
    totalRequests: number;
    totalUnits: number;
    totalCredits: number;
    byEndpoint: Record<string, number>;
    byChain: Record<string, number>;
  }> {
    const usage = await this.getApiUsageByTenant(tenantId, startDate, endDate);
    
    const byEndpoint: Record<string, number> = {};
    const byChain: Record<string, number> = {};
    let totalUnits = 0;
    let totalCredits = 0;

    for (const u of usage) {
      totalUnits += u.units;
      totalCredits += u.credits;
      byEndpoint[u.endpoint] = (byEndpoint[u.endpoint] || 0) + 1;
      if (u.chain) {
        byChain[u.chain] = (byChain[u.chain] || 0) + 1;
      }
    }

    return {
      totalRequests: usage.length,
      totalUnits,
      totalCredits,
      byEndpoint,
      byChain,
    };
  }

  async getBillingAggregation(tenantId: string, period: string): Promise<BillingAggregation | undefined> {
    const [agg] = await db.select().from(billingAggregations)
      .where(and(
        eq(billingAggregations.tenantId, tenantId),
        eq(billingAggregations.period, period)
      ));
    return agg || undefined;
  }

  async upsertBillingAggregation(data: Omit<BillingAggregation, 'id' | 'createdAt'>): Promise<BillingAggregation> {
    const existing = await this.getBillingAggregation(data.tenantId, data.period);
    
    if (existing) {
      const [updated] = await db.update(billingAggregations)
        .set(data)
        .where(eq(billingAggregations.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(billingAggregations)
        .values(data as any)
        .returning();
      return created;
    }
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogsByTenant(tenantId: string, limit = 100): Promise<AuditLog[]> {
    return db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
