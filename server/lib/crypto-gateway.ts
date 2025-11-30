import crypto from "crypto";
import { storage } from "../storage";
import { tatumClient } from "./tatum";
import { gasFeeManager } from "./gas-fees";
import { db } from "../db";
import { virtualAccounts, cryptoTransactions, masterWallets } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Crypto Gateway - Handles Scenario 1 & 3 operations
 * Scenario 1: Your master wallets
 * Scenario 3: Assigned master wallets to clients
 */

export class CryptoGateway {
  /**
   * SCENARIO 1: Create virtual account for client (using your master wallets)
   */
  async createVirtualAccount(tenantId: string, accountType: "crypto" | "token"): Promise<any> {
    const account = await db
      .insert(virtualAccounts)
      .values({
        tenantId,
        accountType,
        balances: JSON.stringify({}),
      })
      .returning();

    return account[0];
  }

  /**
   * SCENARIO 1: Internal swap - no blockchain, instant, 0.5% commission
   */
  async internalSwap(options: {
    tenantId: string;
    scenario: "scenario1" | "scenario3";
    fromAccountId: string;
    toAccountId: string;
    assetName: string;
    blockchain: string;
    fromAmount: string;
    toAmount: string;
    rate: number;
  }): Promise<any> {
    // 1. Validate accounts have balance
    const fromAccount = await db.query.virtualAccounts.findFirst({
      where: eq(virtualAccounts.id, options.fromAccountId),
    });

    if (!fromAccount) throw new Error("From account not found");

    const fromBalances = JSON.parse(fromAccount.balances as any || "{}");
    const fromBalance = parseFloat(fromBalances[options.assetName] || "0");

    if (fromBalance < parseFloat(options.fromAmount)) {
      throw new Error("Insufficient balance");
    }

    // 2. Calculate commission (0.5%)
    const commissionAmount = parseFloat(options.toAmount) * 0.005;
    const netToAmount = parseFloat(options.toAmount) - commissionAmount;

    // 3. Update balances in DB
    const fromBalancesUpdated = { ...fromBalances };
    fromBalancesUpdated[options.assetName] = (fromBalance - parseFloat(options.fromAmount)).toString();

    await db
      .update(virtualAccounts)
      .set({ balances: JSON.stringify(fromBalancesUpdated) })
      .where(eq(virtualAccounts.id, options.fromAccountId));

    const toAccount = await db.query.virtualAccounts.findFirst({
      where: eq(virtualAccounts.id, options.toAccountId),
    });

    const toBalances = JSON.parse(toAccount?.balances as any || "{}");
    toBalances[options.assetName] = (
      parseFloat(toBalances[options.assetName] || "0") + netToAmount
    ).toString();

    await db
      .update(virtualAccounts)
      .set({ balances: JSON.stringify(toBalances) })
      .where(eq(virtualAccounts.id, options.toAccountId));

    // 4. Record transaction
    const tx = await db
      .insert(cryptoTransactions)
      .values({
        tenantId: options.tenantId,
        type: "internal_swap",
        scenario: options.scenario,
        fromAccountId: options.fromAccountId,
        toAccountId: options.toAccountId,
        assetType: "crypto",
        assetName: options.assetName,
        blockchain: options.blockchain,
        amount: options.toAmount,
        commissionAmount: commissionAmount.toString(),
        commissionUsd: (commissionAmount * 45000).toString(), // Example price
        status: "completed",
      })
      .returning();

    return {
      txId: tx[0].id,
      status: "completed",
      fromAmount: options.fromAmount,
      toAmount: options.toAmount,
      commission: commissionAmount.toFixed(8),
      netReceived: netToAmount.toFixed(8),
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * SCENARIO 1 & 3: External withdraw - send to client's wallet
   */
  async externalWithdraw(options: {
    tenantId: string;
    scenario: "scenario1" | "scenario3";
    fromAccountId: string;
    toExternalAddress: string;
    assetName: string;
    blockchain: string;
    amount: string;
    gasMarkupPercent?: number;
  }): Promise<any> {
    // 1. Find master wallet
    const master = await db.query.masterWallets.findFirst({
      where: and(
        eq(masterWallets.assetName, options.assetName),
        eq(masterWallets.blockchain, options.blockchain),
        eq(masterWallets.scenario, options.scenario)
      ),
    });

    if (!master) throw new Error(`No master wallet found for ${options.assetName} on ${options.blockchain}`);

    // 2. Estimate gas
    const gasEstimate = await tatumClient.estimateGas({
      blockchain: options.blockchain,
      assetType: options.assetName === master.smartContractAddress ? "token" : "crypto",
      amount: options.amount,
    });

    // 3. Calculate gas markup using admin config
    const gasCalc = await gasFeeManager.calculateGasMarkup({
      clientId: options.tenantId,
      blockchain: options.blockchain,
      transactionType: options.assetName === "BTC" ? "crypto_withdraw" : "token_transfer",
      gasReal: gasEstimate.gasReal,
    });

    // 4. Update virtual account balance
    const account = await db.query.virtualAccounts.findFirst({
      where: eq(virtualAccounts.id, options.fromAccountId),
    });

    const balances = JSON.parse(account?.balances as any || "{}");
    const currentBalance = parseFloat(balances[options.assetName] || "0");

    if (currentBalance < parseFloat(options.amount)) {
      throw new Error("Insufficient balance");
    }

    balances[options.assetName] = (currentBalance - parseFloat(options.amount)).toString();

    await db
      .update(virtualAccounts)
      .set({ balances: JSON.stringify(balances) })
      .where(eq(virtualAccounts.id, options.fromAccountId));

    // 5. Send via Tatum (mock for now)
    const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;

    // 6. Record transaction
    const tx = await db
      .insert(cryptoTransactions)
      .values({
        tenantId: options.tenantId,
        type: "external_withdraw",
        scenario: options.scenario,
        toExternalAddress: options.toExternalAddress,
        assetType: "crypto",
        assetName: options.assetName,
        blockchain: options.blockchain,
        amount: options.amount,
        gasReal: gasCalc.gasReal.toString(),
        gasMarkupPercent: gasCalc.gasMarkupPercent,
        gasCharged: gasCalc.gasCharged.toString(),
        commissionAmount: gasCalc.yourProfit.toString(),
        status: "pending",
        txHash,
      })
      .returning();

    return {
      txId: tx[0].id,
      status: "pending_confirmation",
      txHash,
      amount: options.amount,
      gasReal: gasCalc.gasReal.toFixed(8),
      gasCharged: gasCalc.gasCharged.toFixed(8),
      yourProfit: gasCalc.yourProfit.toFixed(8),
      estimatedTime: "12 seconds",
    };
  }

  /**
   * SCENARIO 3: Assign master wallet to client
   */
  async assignMasterToClient(masterId: string, tenantId: string, gasMarkup: number): Promise<any> {
    await db
      .update(masterWallets)
      .set({
        assignedToTenantId: tenantId,
        gasMarkupPercentage: gasMarkup,
      })
      .where(eq(masterWallets.id, masterId));

    return {
      success: true,
      masterId,
      assignedTo: tenantId,
      gasMarkup,
      assignedAt: new Date().toISOString(),
    };
  }

  /**
   * Get virtual account balance
   */
  async getVirtualAccountBalance(accountId: string): Promise<any> {
    const account = await db.query.virtualAccounts.findFirst({
      where: eq(virtualAccounts.id, accountId),
    });

    if (!account) throw new Error("Account not found");

    const balances = JSON.parse(account.balances as any || "{}");

    return {
      accountId,
      balances,
      totalUsd: Object.entries(balances)
        .reduce((sum, [asset, balance]) => {
          // Mock pricing
          const prices: Record<string, number> = {
            ETH: 2500,
            BTC: 45000,
            GOLD: 500,
            SILVER: 250,
          };
          return sum + (parseFloat(balance as string) * (prices[asset] || 0));
        }, 0),
    };
  }
}

export const cryptoGateway = new CryptoGateway();
