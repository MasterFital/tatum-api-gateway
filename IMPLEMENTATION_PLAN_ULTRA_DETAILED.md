# 🚀 IMPLEMENTATION PLAN - ULTRA DETAILED
## Complete Task Breakdown with Tatum Integration

---

# 📋 PHASE 0: SETUP & SECURITY

## Task 0.1: Tatum API Key Setup

```
WHAT: Configure Tatum API integration
WHERE: Environment variables
TIME: 5 minutes

STEPS:
1. Go to https://tatum.io (already installed via secrets)
2. Get your API key from environment: TATUM_API_KEY
3. Verify it works:
   curl -H "x-api-key: $TATUM_API_KEY" \
        https://api.tatum.io/v3/bitcoin/info
4. This endpoint returns blockchain info (free call)

EXPECTED RESPONSE:
{
  "chain": "Bitcoin",
  "blocks": 123456,
  "mempool": 5000
}

FILES TO CHECK:
└─ server/lib/tatum.ts (where we'll store all API calls)

SECURITY:
├─ NEVER log TATUM_API_KEY
├─ NEVER commit it
├─ ALWAYS use import.meta.env for env vars
└─ Rate limit: Tatum free tier = 5 requests/second
```

## Task 0.2: Private Key Encryption Setup

```
WHAT: Implement AES-256 encryption for private keys
WHERE: server/lib/encryption.ts (new file)
TIME: 15 minutes

WHAT WE'RE DOING:
├─ Master wallets have PRIVATE KEYS
├─ Can't store in plain text (SECURITY NIGHTMARE)
├─ Need AES-256 encryption + IV (Initialization Vector)
└─ Only decrypt when needed for transactions

CREATE: server/lib/encryption.ts

CODE TEMPLATE:
```typescript
import crypto from 'crypto';

// Generate encryption key from ENV
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  crypto.randomBytes(32).toString('hex');

export function encryptPrivateKey(privateKey: string) {
  const iv = crypto.randomBytes(16); // Random IV
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex')
  };
}

export function decryptPrivateKey(encrypted: string, iv: string) {
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

STORE IN DB:
├─ Column: privateKeyEncrypted (text)
├─ Column: privateKeyIv (text)
└─ Never store ENCRYPTION_KEY in DB (use ENV)

USAGE LATER:
```typescript
// When withdrawing
const decrypted = decryptPrivateKey(
  wallet.privateKeyEncrypted,
  wallet.privateKeyIv
);
// Use decrypted key to sign Tatum transaction
// Never log or expose it
```
```

---

# 📊 PHASE 1: DATABASE SCHEMA

## Task 1.1: Create Master Wallets Table (CRYPTO)

```
WHAT: Table to store YOUR master wallets
WHERE: shared/schema.ts
TIME: 10 minutes

TABLE NAME: master_wallets_crypto
ROWS NEEDED:
- id: UUID (primary key)
- blockchain: 'bitcoin' | 'ethereum' | 'solana' | 'polygon'
- assetName: 'BTC' | 'ETH' | 'SOL' | 'MATIC'
- address: public blockchain address
- privateKeyEncrypted: encrypted private key
- privateKeyIv: IV for decryption
- balance: decimal (cached from Tatum)
- balanceUsd: decimal (cached USD value)
- lastSyncTime: timestamp (when we last synced balance)
- status: 'active' | 'suspended'
- createdAt: timestamp

DRIZZLE CODE:
```typescript
import { pgTable, text, decimal, timestamp, varchar } from 'drizzle-orm/pg-core';

export const masterWalletsCrypto = pgTable('master_wallets_crypto', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  blockchain: text('blockchain').notNull(), // bitcoin, ethereum, solana, polygon
  assetName: text('asset_name').notNull(), // BTC, ETH, SOL, MATIC
  address: text('address').notNull().unique(), // public key
  privateKeyEncrypted: text('private_key_encrypted').notNull(),
  privateKeyIv: text('private_key_iv').notNull(),
  balance: decimal('balance', { precision: 18, scale: 8 }).default('0'),
  balanceUsd: decimal('balance_usd', { precision: 18, scale: 2 }).default('0'),
  lastSyncTime: timestamp('last_sync_time'),
  status: text('status').default('active'), // active, suspended
  createdAt: timestamp('created_at').defaultNow(),
});

export type MasterWalletCrypto = typeof masterWalletsCrypto.$inferSelect;
export type InsertMasterWalletCrypto = typeof masterWalletsCrypto.$inferInsert;
```

INDEXES NEEDED:
```sql
CREATE INDEX idx_master_wallets_blockchain_asset 
  ON master_wallets_crypto(blockchain, asset_name);
CREATE INDEX idx_master_wallets_address 
  ON master_wallets_crypto(address);
```
```

## Task 1.2: Create Virtual Accounts Table (CRYPTO)

```
WHAT: Client accounts with balances
WHERE: shared/schema.ts (add to same file)
TIME: 10 minutes

TABLE NAME: virtual_accounts_crypto
CONCEPT:
├─ Each client has ONE virtual account
├─ Stores balance of EVERY crypto they own
├─ Example: Client holds {BTC: 1.5, ETH: 10, SOL: 100}
└─ Balances stored as JSONB (flexible key-value)

DRIZZLE CODE:
```typescript
export const virtualAccountsCrypto = pgTable('virtual_accounts_crypto', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(), // who owns this
  accountType: text('account_type').notNull(), // individual, business
  balances: jsonb('balances').default('{}'), // { "BTC": "1.5", "ETH": "10" }
  status: text('status').default('active'), // active, frozen
  createdAt: timestamp('created_at').defaultNow(),
});

export type VirtualAccountCrypto = typeof virtualAccountsCrypto.$inferSelect;
export type InsertVirtualAccountCrypto = typeof virtualAccountsCrypto.$inferInsert;
```

WHY JSONB?
├─ Flexible (clients can have ANY combo of cryptos)
├─ Fast queries (indexed)
├─ Easy to add/remove assets
└─ Example: { "BTC": "1.5", "ETH": "10.5", "SOL": "100" }
```

## Task 1.3: Create Crypto Transactions Table

```
WHAT: Log ALL transactions (swaps + withdrawals)
WHERE: shared/schema.ts
TIME: 15 minutes

TABLE NAME: crypto_transactions
PURPOSE:
├─ Track every swap (for commission tracking)
├─ Track every withdrawal (for gas profit tracking)
├─ Audit trail for all transactions
└─ Revenue calculation

DRIZZLE CODE:
```typescript
export const cryptoTransactions = pgTable('crypto_transactions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(), // client who made it
  
  // Transaction type
  type: text('type').notNull(), // 'internal_swap' | 'external_withdraw'
  
  // For swaps
  fromAccountId: varchar('from_account_id'), // internal swap from
  toAccountId: varchar('to_account_id'), // internal swap to
  
  // For external
  toExternalAddress: text('to_external_address'), // where they're sending
  
  // Asset info
  assetName: text('asset_name').notNull(), // BTC, ETH, SOL
  blockchain: text('blockchain').notNull(),
  amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
  
  // YOUR REVENUE TRACKING
  gasReal: decimal('gas_real', { precision: 18, scale: 2 }).default('0'), // blockchain gas
  gasMarkupPercent: integer('gas_markup_percent').default(40), // 40% by default
  gasCharged: decimal('gas_charged', { precision: 18, scale: 2 }).default('0'), // what you charge
  yourProfit: decimal('your_profit', { precision: 18, scale: 2 }).default('0'), // gas profit
  
  // Commission from swaps
  commissionAmount: decimal('commission_amount', { precision: 18, scale: 8 }).default('0'), // 0.5%
  commissionUsd: decimal('commission_usd', { precision: 18, scale: 2 }).default('0'), // in USD
  
  // Status
  status: text('status').default('pending'), // pending, confirmed, failed
  txHash: text('tx_hash'), // blockchain tx hash
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

export type CryptoTransaction = typeof cryptoTransactions.$inferSelect;
export type InsertCryptoTransaction = typeof cryptoTransactions.$inferInsert;
```

INDEXES FOR REVENUE:
```sql
-- Fast revenue queries
CREATE INDEX idx_crypto_transactions_tenant_type 
  ON crypto_transactions(tenant_id, type);
CREATE INDEX idx_crypto_transactions_created_at 
  ON crypto_transactions(created_at);
```
```

## Task 1.4: Create RWA Clients Table

```
WHAT: Track clients who want to emit tokens
WHERE: shared/schema.ts
TIME: 10 minutes

TABLE NAME: rwa_clients
CONCEPT:
├─ Client says: "I want to tokenize 1M oz of GOLD"
├─ We deploy smart contract for GOLD token
├─ We manage infrastructure
├─ We take 100% of commissions
└─ Client pays: $500 setup + $200/year

DRIZZLE CODE:
```typescript
export const rwaClients = pgTable('rwa_clients', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  
  // Token info
  tokenId: text('token_id').notNull(), // GOLD, SILVER
  tokenName: text('token_name').notNull(),
  blockchain: text('blockchain').notNull(), // ethereum, polygon, solana
  
  // Smart contract
  smartContractAddress: text('smart_contract_address'), // ERC-20 address
  totalSupply: decimal('total_supply', { precision: 30, scale: 8 }),
  
  // YOUR FEES
  setupFeeAmount: decimal('setup_fee_amount', { precision: 18, scale: 2 }).default(500),
  setupFeePaid: boolean('setup_fee_paid').default(false),
  setupFeePaidAt: timestamp('setup_fee_paid_at'),
  
  annualFeeAmount: decimal('annual_fee_amount', { precision: 18, scale: 2 }).default(200),
  
  // Status
  status: text('status').default('pending_setup_fee'), // pending_setup_fee, active, paused
  
  createdAt: timestamp('created_at').defaultNow(),
});

export type RwaClient = typeof rwaClients.$inferSelect;
export type InsertRwaClient = typeof rwaClients.$inferInsert;
```
```

## Task 1.5: Create RWA Master Wallets Table

```
WHAT: Master wallet for EACH RWA token
WHERE: shared/schema.ts
TIME: 10 minutes

TABLE NAME: rwa_master_wallets
CONCEPT:
├─ Each RWA token needs a master wallet
├─ Client controls this (not you)
├─ Example: Client's GOLD token master
├─ Where the token contract lives
└─ Client funds it with actual tokens

DRIZZLE CODE:
```typescript
export const rwaMasterWallets = pgTable('rwa_master_wallets', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  rwaClientId: varchar('rwa_client_id').notNull(),
  
  blockchain: text('blockchain').notNull(),
  address: text('address').notNull().unique(),
  
  // CLIENT CONTROLS THIS
  privateKeyEncrypted: text('private_key_encrypted'),
  privateKeyIv: text('private_key_iv'),
  
  balance: decimal('balance', { precision: 30, scale: 8 }).default('0'),
  balanceUsd: decimal('balance_usd', { precision: 18, scale: 2 }).default('0'),
  
  lastSyncTime: timestamp('last_sync_time'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type RwaMasterWallet = typeof rwaMasterWallets.$inferSelect;
export type InsertRwaMasterWallet = typeof rwaMasterWallets.$inferInsert;
```
```

## Task 1.6: Create RWA Virtual Accounts Table

```
WHAT: Sub-client accounts holding RWA tokens
WHERE: shared/schema.ts
TIME: 10 minutes

TABLE NAME: rwa_virtual_accounts
CONCEPT:
├─ Client GOLD Corp has 100 sub-clients
├─ Each sub-client has a virtual account
├─ Holds GOLD tokens (and other tokens if they trade)
├─ Example: SubClient1 holds { "GOLD": "100.5", "SILVER": "50" }
└─ Balances in JSONB

DRIZZLE CODE:
```typescript
export const rwaVirtualAccounts = pgTable('rwa_virtual_accounts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  rwaClientId: varchar('rwa_client_id').notNull(),
  
  // Sub-client identifier
  subClientId: text('sub_client_id').notNull(),
  
  // What token(s) they hold
  tokenId: text('token_id').notNull(), // GOLD, SILVER
  
  // Balance
  balance: decimal('balance', { precision: 30, scale: 8 }).default('0'),
  balances: jsonb('balances').default('{}'), // { "GOLD": "100.5", "SILVER": "50" }
  
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type RwaVirtualAccount = typeof rwaVirtualAccounts.$inferSelect;
export type InsertRwaVirtualAccount = typeof rwaVirtualAccounts.$inferInsert;
```
```

## Task 1.7: Create RWA Transactions Table

```
WHAT: Log transactions on RWA tokens
WHERE: shared/schema.ts
TIME: 15 minutes

TABLE NAME: rwa_transactions
PURPOSE:
├─ Same as crypto_transactions
├─ BUT tracks PER RWA CLIENT
├─ 100% of revenue is yours
└─ Track setup fees + annual fees

DRIZZLE CODE:
```typescript
export const rwaTransactions = pgTable('rwa_transactions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  rwaClientId: varchar('rwa_client_id').notNull(),
  
  // Transaction type
  type: text('type').notNull(), // 'internal_swap' | 'external_withdraw'
  
  // Parties
  fromAccountId: varchar('from_account_id'), // internal
  toAccountId: varchar('to_account_id'), // internal
  toExternalAddress: text('to_external_address'), // external
  
  // Asset
  tokenId: text('token_id').notNull(), // GOLD
  blockchain: text('blockchain').notNull(),
  amount: decimal('amount', { precision: 30, scale: 8 }).notNull(),
  
  // YOUR REVENUE (100% to you)
  gasReal: decimal('gas_real', { precision: 18, scale: 2 }).default('0'),
  gasMarkupPercent: integer('gas_markup_percent').default(40),
  gasCharged: decimal('gas_charged', { precision: 18, scale: 2 }).default('0'),
  yourProfit: decimal('your_profit', { precision: 18, scale: 2 }).default('0'),
  
  // Commission from swaps (100% to you)
  commissionAmount: decimal('commission_amount', { precision: 30, scale: 8 }).default('0'),
  commissionUsd: decimal('commission_usd', { precision: 18, scale: 2 }).default('0'),
  
  // Status
  status: text('status').default('pending'),
  txHash: text('tx_hash'),
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

export type RwaTransaction = typeof rwaTransactions.$inferSelect;
export type InsertRwaTransaction = typeof rwaTransactions.$inferInsert;
```
```

## Task 1.8: Create Gas Settings Table

```
WHAT: Admin controls for gas markup
WHERE: shared/schema.ts
TIME: 10 minutes

TABLE NAME: gas_settings
PURPOSE:
├─ Change 40% markup globally in real-time
├─ Override per client (some pay 50%, some 25%)
├─ Blockchain multipliers (BTC 1.2x, MATIC 0.3x)
└─ Audit trail of all changes

DRIZZLE CODE:
```typescript
export const gasSettings = pgTable('gas_settings', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  
  settingType: text('setting_type').notNull(), // 'global', 'client_override', 'blockchain_multiplier'
  
  // For global
  globalDefaultMarkup: integer('global_default_markup').default(40),
  
  // For client override
  clientId: varchar('client_id'),
  clientMarkup: integer('client_markup'),
  clientMarkupExpiresAt: timestamp('client_markup_expires_at'),
  
  // For blockchain
  blockchain: text('blockchain'),
  blockchainMultiplier: decimal('blockchain_multiplier', { precision: 5, scale: 2 }),
  
  // Audit
  changedBy: text('changed_by'),
  reason: text('reason'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type GasSetting = typeof gasSettings.$inferSelect;
export type InsertGasSetting = typeof gasSettings.$inferInsert;
```
```

---

# 🔗 PHASE 2: TATUM INTEGRATION

## Task 2.1: Tatum Wallet Operations

```
WHAT: Master wallet creation via Tatum
WHERE: server/lib/tatum.ts (create new file)
TIME: 30 minutes

TATUM API WE NEED:
├─ Create wallet (generate address + key)
├─ Get balance
├─ Send transaction
├─ Estimate gas
└─ Get exchange rates (for USD conversion)

CREATE: server/lib/tatum.ts

CODE TEMPLATE:
```typescript
import axios from 'axios';

const TATUM_API = 'https://api.tatum.io/v3';
const API_KEY = process.env.TATUM_API_KEY;

// 1. GENERATE NEW WALLET (for master or RWA)
export async function generateWallet(blockchain: string) {
  try {
    const response = await axios.post(
      `${TATUM_API}/${blockchain}/wallet`,
      {},
      {
        headers: { 'x-api-key': API_KEY }
      }
    );
    
    // Response structure varies by blockchain
    // Bitcoin: { xpub, mnemonic }
    // Ethereum: { xpub, mnemonic }
    // Solana: { address, privateKey }
    
    return {
      blockchain,
      address: response.data.address,
      privateKey: response.data.privateKey, // MUST ENCRYPT THIS
      mnemonic: response.data.mnemonic // optional backup
    };
  } catch (error) {
    console.error('Tatum wallet generation failed:', error);
    throw error;
  }
}

// 2. GET BALANCE
export async function getBalance(blockchain: string, address: string) {
  try {
    const response = await axios.get(
      `${TATUM_API}/${blockchain}/account/balance/${address}`,
      {
        headers: { 'x-api-key': API_KEY }
      }
    );
    
    return {
      blockchain,
      address,
      balance: response.data.balance, // in smallest unit (satoshis for BTC)
      unconfirmed: response.data.unconfirmed,
      nonce: response.data.nonce // for Ethereum nonce tracking
    };
  } catch (error) {
    console.error('Balance fetch failed:', error);
    throw error;
  }
}

// 3. ESTIMATE GAS FEE
export async function estimateGas(blockchain: string, toAddress: string, amount: string) {
  try {
    const response = await axios.post(
      `${TATUM_API}/${blockchain}/transaction/estimate`,
      {
        to: toAddress,
        amount: amount,
        // Other params depend on blockchain
      },
      {
        headers: { 'x-api-key': API_KEY }
      }
    );
    
    return {
      blockchain,
      gasPrice: response.data.gasPrice, // in USD
      gasLimit: response.data.gasLimit, // units
      totalGas: response.data.totalGas // final cost in USD
    };
  } catch (error) {
    console.error('Gas estimation failed:', error);
    throw error;
  }
}

// 4. SEND TRANSACTION (for external withdrawals)
export async function sendTransaction(
  blockchain: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  privateKey: string // DECRYPTED ONLY FOR THIS CALL
) {
  try {
    const response = await axios.post(
      `${TATUM_API}/${blockchain}/transaction/send`,
      {
        to: toAddress,
        amount: amount,
        from: fromAddress,
        privateKey: privateKey, // encrypted in transit by HTTPS
        // Blockchain-specific params
      },
      {
        headers: { 'x-api-key': API_KEY }
      }
    );
    
    return {
      txHash: response.data.txHash,
      nonce: response.data.nonce,
      gasUsed: response.data.gasUsed,
      status: 'pending'
    };
  } catch (error) {
    console.error('Transaction send failed:', error);
    throw error;
  }
}

// 5. GET EXCHANGE RATES (BTC to USD, ETH to USD, etc)
export async function getExchangeRate(currency: string, baseCurrency: 'USD' = 'USD') {
  try {
    const response = await axios.get(
      `${TATUM_API}/rate/${currency}`,
      {
        headers: { 'x-api-key': API_KEY }
      }
    );
    
    return {
      currency,
      baseCurrency,
      rate: response.data.value // 1 BTC = $XX,XXX USD
    };
  } catch (error) {
    console.error('Exchange rate fetch failed:', error);
    throw error;
  }
}

// 6. GET BLOCKCHAIN INFO (for debugging)
export async function getBlockchainInfo(blockchain: string) {
  try {
    const response = await axios.get(
      `${TATUM_API}/${blockchain}/info`,
      {
        headers: { 'x-api-key': API_KEY }
      }
    );
    
    return {
      blockchain,
      blocks: response.data.blocks,
      mempool: response.data.mempool,
      lastBlockTime: response.data.lastBlockTime
    };
  } catch (error) {
    console.error('Blockchain info fetch failed:', error);
    throw error;
  }
}
```

ERROR HANDLING:
```typescript
// Tatum error responses
{
  "statusCode": 400,
  "errorCode": "insufficient_balance",
  "message": "Account does not have sufficient balance for this operation"
}

// Handle in each function:
if (error.response?.status === 400) {
  const errorCode = error.response.data.errorCode;
  // Handle specific errors
  switch(errorCode) {
    case 'insufficient_balance':
      throw new Error('Not enough balance for transaction');
    case 'invalid_address':
      throw new Error('Invalid wallet address');
    // etc
  }
}
```

RATE LIMITS:
├─ Free tier: 5 requests/second
├─ Paid tier: Higher
└─ Check response headers for rate limit info
```

## Task 2.2: Gas Fee Calculation Logic

```
WHAT: Calculate gas fees with markup
WHERE: server/lib/gas-fees.ts (create new file)
TIME: 20 minutes

LOGIC:
├─ Get gas from Tatum
├─ Apply global markup (40%)
├─ Check client override (some pay 50%, 25%)
├─ Apply blockchain multiplier (BTC 1.2x, MATIC 0.3x)
├─ Calculate your profit
└─ Return final gas charged

CODE TEMPLATE:
```typescript
import { db } from './db';
import { gasSettings } from '@shared/schema';
import { estimateGas } from './tatum';

interface GasFeeCalculation {
  gasReal: number;
  gasMarkupPercent: number;
  gasCharged: number;
  yourProfit: number;
}

export async function calculateGasFee(
  tenantId: string,
  blockchain: string,
  toAddress: string,
  amount: string
): Promise<GasFeeCalculation> {
  
  // 1. Get base gas from Tatum
  const tatumGas = await estimateGas(blockchain, toAddress, amount);
  const gasReal = Number(tatumGas.gasPrice); // in USD
  
  // 2. Get global default markup
  let gasMarkupPercent = 40; // default
  
  // 3. Check client override
  const clientOverride = await db
    .select()
    .from(gasSettings)
    .where(
      and(
        eq(gasSettings.clientId, tenantId),
        eq(gasSettings.settingType, 'client_override'),
        or(
          isNull(gasSettings.clientMarkupExpiresAt),
          gt(gasSettings.clientMarkupExpiresAt, new Date())
        )
      )
    )
    .limit(1);
  
  if (clientOverride.length > 0) {
    gasMarkupPercent = clientOverride[0].clientMarkup || 40;
  }
  
  // 4. Apply blockchain multiplier
  let multiplier = 1.0;
  const blockchainMult = await db
    .select()
    .from(gasSettings)
    .where(
      and(
        eq(gasSettings.blockchain, blockchain),
        eq(gasSettings.settingType, 'blockchain_multiplier')
      )
    )
    .limit(1);
  
  if (blockchainMult.length > 0) {
    multiplier = Number(blockchainMult[0].blockchainMultiplier);
  }
  
  // 5. Calculate final fees
  const adjustedGas = gasReal * multiplier;
  const markup = adjustedGas * (gasMarkupPercent / 100);
  const gasCharged = adjustedGas + markup;
  const yourProfit = gasCharged - adjustedGas;
  
  return {
    gasReal: adjustedGas,
    gasMarkupPercent,
    gasCharged,
    yourProfit
  };
}

// Example calculation:
// gasReal: $5
// multiplier: 1.0 (Ethereum base)
// gasMarkupPercent: 40
// adjustedGas: $5
// markup: $5 * 0.4 = $2
// gasCharged: $5 + $2 = $7
// yourProfit: $2 ✅
```
```

---

# 🔌 PHASE 3: API ENDPOINTS (CRYPTO PANEL)

## Task 3.1: POST /api/crypto/accounts/create

```
WHAT: Create virtual crypto account for client
WHERE: server/routes.ts (add new routes)
TIME: 15 minutes

ENDPOINT SPEC:
POST /api/crypto/accounts/create
Authorization: Bearer {API_KEY}
X-Tenant-ID: {TENANT_ID}

REQUEST:
```json
{
  "accountType": "individual",
  "tier": "starter"
}
```

RESPONSE (201 Created):
```json
{
  "accountId": "acc-crypto-001",
  "tenantId": "tenant-001",
  "balances": {
    "BTC": "0",
    "ETH": "0",
    "SOL": "0",
    "MATIC": "0"
  },
  "status": "active",
  "createdAt": "2024-12-01T10:00:00Z"
}
```

BACKEND LOGIC:
1. Extract tenantId from X-Tenant-ID header
2. Verify API key is valid for this tenant
3. Check tier limits (starter = 1 account, premium = 10 accounts)
4. Create virtual_accounts_crypto record:
   - balances: empty JSONB (will fill as they trade)
5. Return account ID

VALIDATION:
├─ API key must exist
├─ Tenant must exist
├─ Tier limits not exceeded
└─ accountType must be 'individual' or 'business'

ERROR RESPONSES:
├─ 401: Invalid API key
├─ 403: Tier limit exceeded
├─ 400: Invalid accountType
└─ 500: Database error

CODE:
```typescript
router.post('/api/crypto/accounts/create', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { accountType } = req.body;
    
    // 1. Validate
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    if (!['individual', 'business'].includes(accountType)) {
      return res.status(400).json({ error: 'Invalid account type' });
    }
    
    // 2. Check tier limits (fetch from storage/db)
    const existingAccounts = await db
      .select()
      .from(virtualAccountsCrypto)
      .where(eq(virtualAccountsCrypto.tenantId, tenantId as string));
    
    if (existingAccounts.length >= 5) { // example limit
      return res.status(403).json({ error: 'Tier limit exceeded' });
    }
    
    // 3. Create account
    const result = await db
      .insert(virtualAccountsCrypto)
      .values({
        tenantId: tenantId as string,
        accountType,
        balances: {} // empty initially
      })
      .returning();
    
    // 4. Return response
    res.status(201).json({
      accountId: result[0].id,
      tenantId,
      balances: result[0].balances,
      status: 'active',
      createdAt: result[0].createdAt
    });
  } catch (error) {
    console.error('Account creation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```
```

## Task 3.2: GET /api/crypto/accounts/{accountId}/balance

```
WHAT: Get client's current balances
WHERE: server/routes.ts (add to same file)
TIME: 15 minutes

ENDPOINT SPEC:
GET /api/crypto/accounts/{accountId}/balance
Authorization: Bearer {API_KEY}

RESPONSE:
```json
{
  "accountId": "acc-crypto-001",
  "balances": {
    "BTC": "1.5",
    "ETH": "10.0",
    "SOL": "100.0",
    "MATIC": "500.0"
  },
  "balancesUsd": {
    "BTC": 67500,
    "ETH": 25000,
    "SOL": 1000,
    "MATIC": 250
  },
  "totalUsd": 93750
}
```

BACKEND LOGIC:
1. Get virtual_accounts_crypto record
2. Parse JSONB balances
3. For each asset, get current exchange rate from Tatum
4. Convert to USD
5. Sum totals
6. Return formatted response

CODE:
```typescript
router.get('/api/crypto/accounts/:accountId/balance', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // 1. Fetch account
    const account = await db
      .select()
      .from(virtualAccountsCrypto)
      .where(eq(virtualAccountsCrypto.id, accountId))
      .limit(1);
    
    if (!account.length) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const balances = account[0].balances || {};
    const balancesUsd: Record<string, number> = {};
    let totalUsd = 0;
    
    // 2. Convert to USD
    for (const [asset, amount] of Object.entries(balances)) {
      const rate = await getExchangeRate(asset); // from tatum.ts
      const usdAmount = Number(amount) * rate;
      balancesUsd[asset] = usdAmount;
      totalUsd += usdAmount;
    }
    
    // 3. Return
    res.json({
      accountId,
      balances,
      balancesUsd,
      totalUsd
    });
  } catch (error) {
    console.error('Balance fetch failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```
```

## Task 3.3: POST /api/crypto/swap/internal

```
WHAT: Internal swap (BTC → ETH) - database only, instant
WHERE: server/routes.ts
TIME: 20 minutes

ENDPOINT SPEC:
POST /api/crypto/swap/internal
Authorization: Bearer {API_KEY}

REQUEST:
```json
{
  "fromAccountId": "acc-crypto-001",
  "toAccountId": "acc-crypto-002",
  "fromAsset": "BTC",
  "toAsset": "ETH",
  "fromAmount": "1.0",
  "toAmount": "15.0",
  "rate": 15.0,
  "slippage": 0.5
}
```

RESPONSE:
```json
{
  "txId": "tx-swap-001",
  "status": "completed",
  "swap": "1.0 BTC → 15.0 ETH",
  "fromAmount": "1.0",
  "toAmount": "15.0",
  "commission": "0.075",
  "commissionUsd": "125.00",
  "netReceived": "14.925",
  "executedAt": "2024-12-01T10:05:00Z"
}
```

BACKEND LOGIC:
1. Validate both accounts exist & belong to authorized tenant
2. Check fromAccount has sufficient balance
3. Calculate commission: toAmount * 0.5% = commission
4. Update fromAccount: balance[fromAsset] -= fromAmount
5. Update toAccount: balance[toAsset] += (toAmount - commission)
6. Store commission in revenue tracking
7. Create crypto_transactions record
8. Return transaction

REVENUE TRACKING:
├─ Commission: 0.075 ETH
├─ Get USD rate for ETH: $1,666.67/ETH
├─ Your revenue: 0.075 × $1,666.67 = $125
└─ Store in crypto_transactions.commissionUsd

CODE:
```typescript
router.post('/api/crypto/swap/internal', async (req, res) => {
  try {
    const {
      fromAccountId,
      toAccountId,
      fromAsset,
      toAsset,
      fromAmount,
      toAmount
    } = req.body;
    
    // 1. Fetch both accounts
    const fromAccount = await db
      .select()
      .from(virtualAccountsCrypto)
      .where(eq(virtualAccountsCrypto.id, fromAccountId))
      .limit(1);
    
    const toAccount = await db
      .select()
      .from(virtualAccountsCrypto)
      .where(eq(virtualAccountsCrypto.id, toAccountId))
      .limit(1);
    
    if (!fromAccount.length || !toAccount.length) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // 2. Check balance
    const fromBalances = fromAccount[0].balances || {};
    const fromBalance = Number(fromBalances[fromAsset] || 0);
    
    if (fromBalance < Number(fromAmount)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // 3. Calculate commission
    const commission = Number(toAmount) * 0.005; // 0.5%
    const netReceived = Number(toAmount) - commission;
    
    // 4. Get USD rate
    const rate = await getExchangeRate(toAsset);
    const commissionUsd = commission * rate;
    
    // 5. Update balances
    const newFromBalances = { ...fromBalances };
    newFromBalances[fromAsset] = String(fromBalance - Number(fromAmount));
    
    const toBalances = toAccount[0].balances || {};
    const toBalance = Number(toBalances[toAsset] || 0);
    const newToBalances = { ...toBalances };
    newToBalances[toAsset] = String(toBalance + netReceived);
    
    await db
      .update(virtualAccountsCrypto)
      .set({ balances: newFromBalances })
      .where(eq(virtualAccountsCrypto.id, fromAccountId));
    
    await db
      .update(virtualAccountsCrypto)
      .set({ balances: newToBalances })
      .where(eq(virtualAccountsCrypto.id, toAccountId));
    
    // 6. Create transaction record
    const tx = await db
      .insert(cryptoTransactions)
      .values({
        tenantId: req.headers['x-tenant-id'] as string,
        type: 'internal_swap',
        fromAccountId,
        toAccountId,
        assetName: toAsset,
        blockchain: 'internal',
        amount: new Decimal(toAmount),
        commissionAmount: new Decimal(commission.toString()),
        commissionUsd: new Decimal(commissionUsd.toString()),
        status: 'completed'
      })
      .returning();
    
    // 7. Return response
    res.json({
      txId: tx[0].id,
      status: 'completed',
      swap: `${fromAmount} ${fromAsset} → ${toAmount} ${toAsset}`,
      fromAmount,
      toAmount,
      commission: commission.toString(),
      commissionUsd: commissionUsd.toString(),
      netReceived: netReceived.toString(),
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Swap failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```
```

## Task 3.4: POST /api/crypto/withdraw

```
WHAT: External withdraw (send to real wallet) - blockchain transaction
WHERE: server/routes.ts
TIME: 30 minutes

ENDPOINT SPEC:
POST /api/crypto/withdraw
Authorization: Bearer {API_KEY}

REQUEST:
```json
{
  "fromAccountId": "acc-crypto-001",
  "toWalletAddress": "0xabcdef1234567890abcdef1234567890abcdef12",
  "assetName": "ETH",
  "blockchain": "ethereum",
  "amount": "0.5",
  "gasPriority": "standard"
}
```

RESPONSE:
```json
{
  "txId": "tx-withdraw-001",
  "status": "pending_confirmation",
  "txHash": "0x1234567890abcdef...",
  "amount": "0.5",
  "blockchain": "ethereum",
  "assetName": "ETH",
  "gasReal": "3.0",
  "gasMarkupPercent": 40,
  "gasCharged": "4.2",
  "yourProfit": "1.2",
  "totalCost": "7.7",
  "estimatedTime": "12 seconds",
  "createdAt": "2024-12-01T10:10:00Z"
}
```

BACKEND LOGIC:
1. Validate account & address
2. Check sufficient balance
3. Find master wallet for asset/blockchain
4. Calculate gas fee (with markup & overrides)
5. Decrypt master wallet's private key
6. Send transaction via Tatum
7. Capture txHash
8. Create crypto_transactions record
9. Store your profit
10. Return response

CRITICAL: PRIVATE KEY HANDLING
├─ Only decrypt when sending
├─ Never log it
├─ Never return it
├─ Delete from memory after use
└─ All communication via HTTPS

CODE:
```typescript
router.post('/api/crypto/withdraw', async (req, res) => {
  try {
    const {
      fromAccountId,
      toWalletAddress,
      assetName,
      blockchain,
      amount,
      gasPriority
    } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    // 1. Validate
    if (!Web3.isAddress(toWalletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    
    // 2. Check account balance
    const account = await db
      .select()
      .from(virtualAccountsCrypto)
      .where(eq(virtualAccountsCrypto.id, fromAccountId))
      .limit(1);
    
    if (!account.length) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const balances = account[0].balances || {};
    const currentBalance = Number(balances[assetName] || 0);
    
    if (currentBalance < Number(amount)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // 3. Calculate gas
    const gasFee = await calculateGasFee(
      tenantId,
      blockchain,
      toWalletAddress,
      amount
    );
    
    // 4. Find master wallet
    const masterWallet = await db
      .select()
      .from(masterWalletsCrypto)
      .where(
        and(
          eq(masterWalletsCrypto.blockchain, blockchain),
          eq(masterWalletsCrypto.assetName, assetName)
        )
      )
      .limit(1);
    
    if (!masterWallet.length) {
      return res.status(400).json({ error: 'Master wallet not configured' });
    }
    
    // 5. Decrypt private key
    const decryptedKey = decryptPrivateKey(
      masterWallet[0].privateKeyEncrypted,
      masterWallet[0].privateKeyIv
    );
    
    // 6. Send transaction via Tatum
    const tatumTx = await sendTransaction(
      blockchain,
      masterWallet[0].address,
      toWalletAddress,
      amount,
      decryptedKey
    );
    
    // 7. Update account balance
    const newBalances = { ...balances };
    newBalances[assetName] = String(Number(balances[assetName]) - Number(amount));
    
    await db
      .update(virtualAccountsCrypto)
      .set({ balances: newBalances })
      .where(eq(virtualAccountsCrypto.id, fromAccountId));
    
    // 8. Create transaction record
    const tx = await db
      .insert(cryptoTransactions)
      .values({
        tenantId,
        type: 'external_withdraw',
        fromAccountId,
        toExternalAddress: toWalletAddress,
        assetName,
        blockchain,
        amount: new Decimal(amount),
        gasReal: new Decimal(gasFee.gasReal.toString()),
        gasMarkupPercent: gasFee.gasMarkupPercent,
        gasCharged: new Decimal(gasFee.gasCharged.toString()),
        yourProfit: new Decimal(gasFee.yourProfit.toString()),
        txHash: tatumTx.txHash,
        status: 'pending_confirmation'
      })
      .returning();
    
    // 9. Return response
    res.json({
      txId: tx[0].id,
      status: 'pending_confirmation',
      txHash: tatumTx.txHash,
      amount,
      blockchain,
      assetName,
      gasReal: gasFee.gasReal,
      gasMarkupPercent: gasFee.gasMarkupPercent,
      gasCharged: gasFee.gasCharged,
      yourProfit: gasFee.yourProfit,
      totalCost: (Number(amount) + gasFee.gasCharged).toString(),
      estimatedTime: '12 seconds',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Withdrawal failed:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});
```
```

---

# 🎫 PHASE 4: API ENDPOINTS (RWA PANEL)

## Task 4.1: POST /api/rwa/clients/create

```
WHAT: Create RWA client (client wants to emit token)
WHERE: server/routes.ts
TIME: 30 minutes

ENDPOINT SPEC:
POST /api/rwa/clients/create
Authorization: Bearer {ADMIN_KEY}

REQUEST:
```json
{
  "tenantId": "tenant-gold-corp",
  "tokenId": "GOLD",
  "tokenName": "Gold Token",
  "blockchain": "ethereum",
  "totalSupply": "1000000"
}
```

RESPONSE:
```json
{
  "rwaClientId": "rwa-001",
  "tenantId": "tenant-gold-corp",
  "tokenId": "GOLD",
  "tokenName": "Gold Token",
  "blockchain": "ethereum",
  "smartContractAddress": "0x1234567890abcdef...",
  "masterAddress": "0xAAAA...",
  "setupFeeRequired": 500,
  "annualFee": 200,
  "status": "pending_setup_fee",
  "createdAt": "2024-12-01T11:00:00Z",
  "setupInstructions": {
    "step1": "Pay $500 setup fee",
    "step2": "Verify payment",
    "step3": "Tokens go live"
  }
}
```

BACKEND LOGIC:
1. Verify ADMIN_KEY (only admins can create RWA)
2. Generate master wallet via Tatum
3. Deploy ERC-20 smart contract
4. Create rwa_clients record
5. Create rwa_master_wallets record
6. Set status to 'pending_setup_fee'
7. Generate invoice for setup fee
8. Return response

SMART CONTRACT DEPLOYMENT:
├─ Use Tatum's smart contract API
├─ Or use Hardhat pre-deployed template
├─ Store contract address in DB
└─ Mint total supply to master wallet

CODE:
```typescript
router.post('/api/rwa/clients/create', async (req, res) => {
  try {
    // 1. Verify admin key
    const adminKey = req.headers['authorization']?.split(' ')[1];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Admin key required' });
    }
    
    const {
      tenantId,
      tokenId,
      tokenName,
      blockchain,
      totalSupply
    } = req.body;
    
    // 2. Generate master wallet
    const wallet = await generateWallet(blockchain);
    
    // 3. Deploy smart contract (mock for now)
    // In production: use Tatum smart contract API
    const smartContractAddress = `0x${Math.random().toString(16).slice(2)}`; // mock
    
    // 4. Create RWA client
    const rwaClient = await db
      .insert(rwaClients)
      .values({
        tenantId,
        tokenId,
        tokenName,
        blockchain,
        smartContractAddress,
        totalSupply: new Decimal(totalSupply),
        setupFeeAmount: new Decimal(500),
        annualFeeAmount: new Decimal(200),
        status: 'pending_setup_fee'
      })
      .returning();
    
    // 5. Create master wallet record
    const { encrypted, iv } = encryptPrivateKey(wallet.privateKey);
    
    await db
      .insert(rwaMasterWallets)
      .values({
        rwaClientId: rwaClient[0].id,
        blockchain,
        address: wallet.address,
        privateKeyEncrypted: encrypted,
        privateKeyIv: iv
      });
    
    // 6. Return response
    res.status(201).json({
      rwaClientId: rwaClient[0].id,
      tenantId,
      tokenId,
      tokenName,
      blockchain,
      smartContractAddress,
      masterAddress: wallet.address,
      setupFeeRequired: 500,
      annualFee: 200,
      status: 'pending_setup_fee',
      createdAt: new Date().toISOString(),
      setupInstructions: {
        step1: 'Pay $500 setup fee to activate',
        step2: 'We verify payment',
        step3: 'Your tokens go live'
      }
    });
  } catch (error) {
    console.error('RWA client creation failed:', error);
    res.status(500).json({ error: 'Creation failed' });
  }
});
```
```

## Task 4.2: POST /api/rwa/swap/internal/{rwaClientId}

```
SAME AS CRYPTO PANEL (Task 3.3)
BUT:
├─ Add rwaClientId to tracking
├─ 100% of commission to YOU (not shared)
├─ Store in rwa_transactions instead
└─ Check client status is 'active'

ENDPOINT SPEC:
POST /api/rwa/swap/internal/{rwaClientId}
Authorization: Bearer {API_KEY}

REQUEST:
```json
{
  "fromAccountId": "rwa-sub-account-1",
  "toAccountId": "rwa-sub-account-2",
  "fromToken": "GOLD",
  "toToken": "SILVER",
  "fromAmount": "100",
  "toAmount": "200",
  "rate": 2.0
}
```

REVENUE: 100% to you
├─ Commission: 200 * 0.5% = 1 SILVER
├─ At $50/SILVER = $50
└─ YOUR PROFIT: $50 (client gets nothing)
```

## Task 4.3: POST /api/rwa/withdraw/{rwaClientId}

```
SAME AS CRYPTO PANEL (Task 3.4)
BUT:
├─ For RWA token transfers (ERC-20)
├─ 100% of gas markup to YOU
├─ Store in rwa_transactions
└─ Check setup fee was paid

ENDPOINT SPEC:
POST /api/rwa/withdraw/{rwaClientId}
Authorization: Bearer {API_KEY}

REQUEST:
```json
{
  "fromAccountId": "rwa-sub-account-1",
  "toWalletAddress": "0xBBBB...",
  "tokenId": "GOLD",
  "amount": "50"
}
```

REVENUE: 100% to you
├─ Gas real: $5
├─ Markup 40%: $2
└─ YOUR PROFIT: $2
```

---

# 💰 PHASE 5: ADMIN ENDPOINTS

## Task 5.1: GET /api/admin/gas-settings

```
WHAT: View current gas configuration
WHERE: server/routes.ts
TIME: 15 minutes

ENDPOINT SPEC:
GET /api/admin/gas-settings
Authorization: Bearer {ADMIN_KEY}

RESPONSE:
```json
{
  "globalDefaultMarkup": 40,
  "minMarkup": 10,
  "maxMarkup": 100,
  
  "clientOverrides": {
    "tenant-001": {
      "markup": 50,
      "reason": "High volume customer",
      "expiresAt": "2025-12-31"
    },
    "tenant-002": {
      "markup": 25,
      "reason": "Enterprise partnership",
      "expiresAt": null
    }
  },
  
  "blockchainMultipliers": {
    "bitcoin": 1.2,
    "ethereum": 1.0,
    "polygon": 0.3,
    "solana": 0.1
  }
}
```
```

## Task 5.2: PUT /api/admin/gas-settings

```
WHAT: Change gas settings in real-time
WHERE: server/routes.ts
TIME: 15 minutes

ENDPOINT SPEC:
PUT /api/admin/gas-settings
Authorization: Bearer {ADMIN_KEY}

REQUEST:
```json
{
  "setting": "globalDefaultMarkup",
  "value": 45,
  "effectiveImmediately": true
}
```

OR change client override:
```json
{
  "setting": "clientOverride",
  "clientId": "tenant-001",
  "markup": 50,
  "expiresAt": "2025-12-31"
}
```

OR change blockchain multiplier:
```json
{
  "setting": "blockchainMultiplier",
  "blockchain": "ethereum",
  "multiplier": 0.8
}
```

RESPONSE:
```json
{
  "success": true,
  "previousValue": 40,
  "newValue": 45,
  "appliedAt": "2024-12-01T12:00:00Z",
  "affectsTransactionsFrom": "2024-12-01T12:00:00Z"
}
```
```

## Task 5.3: GET /api/admin/revenue/crypto

```
WHAT: Revenue report for Crypto panel
WHERE: server/routes.ts
TIME: 20 minutes

ENDPOINT SPEC:
GET /api/admin/revenue/crypto?period=2024-12
Authorization: Bearer {ADMIN_KEY}

RESPONSE:
```json
{
  "period": "2024-12",
  "panelName": "CRYPTO",
  
  "swapsInternal": {
    "totalVolume": 5000000,
    "totalSwaps": 10000,
    "commissionRate": 0.5,
    "earned": 25000
  },
  
  "gasMarkup": {
    "totalGasReal": 300000,
    "totalGasCharged": 420000,
    "markupPercent": 40,
    "earned": 120000
  },
  
  "totalEarned": 145000,
  "costs": 25000,
  "netProfit": 120000,
  "profitMargin": 0.827,
  
  "breakdown": {
    "transactions": 10000,
    "uniqueAccounts": 1000,
    "averageTxSize": 500,
    "averageCommission": 14.50,
    "topAssets": [
      { "asset": "ETH", "volume": 2000000, "commission": 50000 },
      { "asset": "BTC", "volume": 1500000, "commission": 37500 },
      { "asset": "SOL", "volume": 1000000, "commission": 25000 }
    ]
  }
}
```
```

## Task 5.4: GET /api/admin/revenue/rwa

```
WHAT: Revenue report for RWA panel
WHERE: server/routes.ts
TIME: 20 minutes

ENDPOINT SPEC:
GET /api/admin/revenue/rwa?period=2024-12
Authorization: Bearer {ADMIN_KEY}

RESPONSE:
```json
{
  "period": "2024-12",
  "panelName": "RWA",
  
  "setupFees": {
    "count": 5,
    "feePerClient": 500,
    "earned": 2500
  },
  
  "annualFees": {
    "activeClients": 20,
    "feePerClient": 200,
    "monthlyPortionEarned": 3333
  },
  
  "byClient": [
    {
      "clientId": "rwa-001",
      "tokenId": "GOLD",
      "monthlyVolume": 500000,
      
      "swapsInternal": {
        "volumeSwaps": 10000,
        "earned": 50
      },
      
      "gasMarkup": {
        "totalTransactions": 100,
        "earned": 200
      },
      
      "tradingVolume": {
        "volume": 500000,
        "commissionRate": 0.5,
        "earned": 2500
      },
      
      "clientTotalThisMonth": 2750,
      "yourTotalThisMonth": 2750
    }
  ],
  
  "totalEarned": 87500,
  "costs": 15000,
  "netProfit": 72500,
  "profitMargin": 0.828
}
```
```

---

# 📊 PHASE 6: REVENUE TRACKING

## Task 6.1: Monthly Revenue Aggregation

```
WHAT: Calculate monthly profit
WHERE: server/lib/revenue.ts (new file)
TIME: 30 minutes

WHAT WE DO:
1. Query all crypto_transactions for month
2. Sum commission + gas profit
3. Query all rwa_transactions for month
4. Sum commission + gas profit
5. Calculate total profit
6. Store in analytics table
7. Generate dashboard data

CODE TEMPLATE:
```typescript
export async function calculateMonthlyRevenue(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  
  // 1. Crypto revenue
  const cryptoTxs = await db
    .select()
    .from(cryptoTransactions)
    .where(
      and(
        gte(cryptoTransactions.createdAt, startDate),
        lt(cryptoTransactions.createdAt, endDate)
      )
    );
  
  let cryptoCommission = 0;
  let cryptoGasProfit = 0;
  
  for (const tx of cryptoTxs) {
    cryptoCommission += Number(tx.commissionUsd) || 0;
    cryptoGasProfit += Number(tx.yourProfit) || 0;
  }
  
  // 2. RWA revenue
  const rwaTxs = await db
    .select()
    .from(rwaTransactions)
    .where(
      and(
        gte(rwaTransactions.createdAt, startDate),
        lt(rwaTransactions.createdAt, endDate)
      )
    );
  
  let rwaCommission = 0;
  let rwaGasProfit = 0;
  let rwaSetupFees = 0;
  let rwaAnnualFees = 0;
  
  for (const tx of rwaTxs) {
    rwaCommission += Number(tx.commissionUsd) || 0;
    rwaGasProfit += Number(tx.yourProfit) || 0;
  }
  
  // 3. RWA setup & annual fees
  const rwaClients = await db
    .select()
    .from(rwaClients)
    .where(
      and(
        gte(rwaClients.createdAt, startDate),
        lt(rwaClients.createdAt, endDate),
        eq(rwaClients.setupFeePaid, true)
      )
    );
  
  rwaSetupFees = rwaClients.length * 500;
  rwaAnnualFees = rwaClients.length * 200 / 12; // monthly portion
  
  // 4. Calculate totals
  const cryptoTotal = cryptoCommission + cryptoGasProfit;
  const rwaTotal = rwaCommission + rwaGasProfit + rwaSetupFees + rwaAnnualFees;
  const grandTotal = cryptoTotal + rwaTotal;
  
  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    crypto: {
      commission: cryptoCommission,
      gasProfit: cryptoGasProfit,
      total: cryptoTotal
    },
    rwa: {
      commission: rwaCommission,
      gasProfit: rwaGasProfit,
      setupFees: rwaSetupFees,
      annualFees: rwaAnnualFees,
      total: rwaTotal
    },
    grand_total: grandTotal,
    costs: 15000, // example
    netProfit: grandTotal - 15000
  };
}
```
```

---

# ✅ FINAL TASK LIST

```
PHASE 0: SETUP
[ ] 0.1 - Tatum API Key Setup (5 min)
[ ] 0.2 - Private Key Encryption (15 min)

PHASE 1: DATABASE
[ ] 1.1 - Master Wallets Table (10 min)
[ ] 1.2 - Virtual Accounts Table (10 min)
[ ] 1.3 - Crypto Transactions Table (15 min)
[ ] 1.4 - RWA Clients Table (10 min)
[ ] 1.5 - RWA Master Wallets Table (10 min)
[ ] 1.6 - RWA Virtual Accounts Table (10 min)
[ ] 1.7 - RWA Transactions Table (15 min)
[ ] 1.8 - Gas Settings Table (10 min)

PHASE 2: TATUM INTEGRATION
[ ] 2.1 - Tatum Wallet Operations (30 min)
[ ] 2.2 - Gas Fee Calculation (20 min)

PHASE 3: CRYPTO ENDPOINTS
[ ] 3.1 - POST /api/crypto/accounts/create (15 min)
[ ] 3.2 - GET /api/crypto/accounts/{id}/balance (15 min)
[ ] 3.3 - POST /api/crypto/swap/internal (20 min)
[ ] 3.4 - POST /api/crypto/withdraw (30 min)

PHASE 4: RWA ENDPOINTS
[ ] 4.1 - POST /api/rwa/clients/create (30 min)
[ ] 4.2 - POST /api/rwa/swap/internal (20 min)
[ ] 4.3 - POST /api/rwa/withdraw (30 min)

PHASE 5: ADMIN ENDPOINTS
[ ] 5.1 - GET /api/admin/gas-settings (15 min)
[ ] 5.2 - PUT /api/admin/gas-settings (15 min)
[ ] 5.3 - GET /api/admin/revenue/crypto (20 min)
[ ] 5.4 - GET /api/admin/revenue/rwa (20 min)

PHASE 6: REVENUE
[ ] 6.1 - Monthly Revenue Aggregation (30 min)

TOTAL TIME: ~385 minutes (6.5 hours)
```

---

This is the ULTRA DETAILED implementation plan.
Every endpoint, every database field, every revenue calculation.
Ready to implement? 🚀
