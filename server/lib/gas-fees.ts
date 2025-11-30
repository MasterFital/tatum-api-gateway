import { db } from "../db";
import { gasSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface GasFeeConfig {
  globalDefaultMarkup: number;
  minMarkup: number;
  maxMarkup: number;
  clientOverrides: Record<string, { markup: number; reason?: string; expiresAt?: string }>;
  blockchainMultipliers: Record<string, number>;
  transactionTypeOverrides: Record<string, number>;
}

export class GasFeeManager {
  private config: GasFeeConfig | null = null;

  async loadConfig(): Promise<GasFeeConfig> {
    const [settings] = await db.select().from(gasSettings).limit(1);
    
    if (!settings) {
      const defaultConfig: GasFeeConfig = {
        globalDefaultMarkup: 40,
        minMarkup: 10,
        maxMarkup: 100,
        clientOverrides: {},
        blockchainMultipliers: {
          ethereum: 1.0,
          polygon: 0.3,
          bitcoin: 1.2,
          solana: 0.1,
          arbitrum: 0.2,
        },
        transactionTypeOverrides: {
          crypto_withdraw: 40,
          token_transfer: 45,
          smart_contract: 60,
        },
      };
      
      this.config = defaultConfig;
      return defaultConfig;
    }

    this.config = {
      globalDefaultMarkup: settings.globalDefaultMarkup,
      minMarkup: settings.minMarkup,
      maxMarkup: settings.maxMarkup,
      clientOverrides: (settings.clientOverrides as Record<string, any>) || {},
      blockchainMultipliers: (settings.blockchainMultipliers as Record<string, number>) || {},
      transactionTypeOverrides: (settings.transactionTypeOverrides as Record<string, number>) || {},
    };

    return this.config;
  }

  /**
   * Calculate gas markup for a specific transaction
   */
  async calculateGasMarkup(options: {
    clientId?: string;
    blockchain: string;
    transactionType: string;
    gasReal: number;
  }): Promise<{
    gasReal: number;
    gasMarkupPercent: number;
    gasCharged: number;
    yourProfit: number;
  }> {
    if (!this.config) {
      await this.loadConfig();
    }

    let markup = this.config!.globalDefaultMarkup;

    // 1. Check client override
    if (options.clientId && this.config!.clientOverrides[options.clientId]) {
      const override = this.config!.clientOverrides[options.clientId];
      
      // Check if expired
      if (override.expiresAt) {
        const expiresAt = new Date(override.expiresAt);
        if (new Date() < expiresAt) {
          markup = override.markup;
        }
      } else {
        markup = override.markup;
      }
    }

    // 2. Check transaction type override
    const typeOverride = this.config!.transactionTypeOverrides[options.transactionType];
    if (typeOverride) {
      markup = typeOverride;
    }

    // 3. Apply blockchain multiplier
    const blockchainMultiplier = this.config!.blockchainMultipliers[options.blockchain] || 1.0;
    markup = Math.round(markup * blockchainMultiplier);

    // 4. Clamp to min/max
    markup = Math.max(this.config!.minMarkup, Math.min(this.config!.maxMarkup, markup));

    // 5. Calculate final amounts
    const markupAmount = options.gasReal * (markup / 100);
    const gasCharged = options.gasReal + markupAmount;
    const yourProfit = markupAmount;

    return {
      gasReal: options.gasReal,
      gasMarkupPercent: markup,
      gasCharged,
      yourProfit,
    };
  }

  /**
   * Update global gas settings
   */
  async updateGlobalMarkup(newMarkup: number, admin: string): Promise<void> {
    newMarkup = Math.max(10, Math.min(100, newMarkup));

    await db
      .update(gasSettings)
      .set({
        globalDefaultMarkup: newMarkup,
        updatedAt: new Date(),
        updatedBy: admin,
      })
      .where(eq(gasSettings.id, "default"));

    this.config = null;
    await this.loadConfig();
  }

  /**
   * Set client-specific gas markup
   */
  async setClientMarkup(
    clientId: string,
    markup: number,
    reason: string,
    admin: string,
    expiresAt?: Date
  ): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    const overrides = this.config!.clientOverrides;
    overrides[clientId] = {
      markup: Math.max(10, Math.min(100, markup)),
      reason,
      expiresAt: expiresAt?.toISOString(),
    };

    await db
      .update(gasSettings)
      .set({
        clientOverrides: overrides as any,
        updatedAt: new Date(),
        updatedBy: admin,
      })
      .where(eq(gasSettings.id, "default"));

    this.config = null;
    await this.loadConfig();
  }

  /**
   * Remove client-specific markup
   */
  async removeClientMarkup(clientId: string, admin: string): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    const overrides = this.config!.clientOverrides;
    delete overrides[clientId];

    await db
      .update(gasSettings)
      .set({
        clientOverrides: overrides as any,
        updatedAt: new Date(),
        updatedBy: admin,
      })
      .where(eq(gasSettings.id, "default"));

    this.config = null;
    await this.loadConfig();
  }

  /**
   * Get current config
   */
  getConfig(): GasFeeConfig | null {
    return this.config;
  }
}

export const gasFeeManager = new GasFeeManager();
