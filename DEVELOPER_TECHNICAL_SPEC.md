# 🏗️ TECHNICAL SPECIFICATION - DUAL PANEL CRYPTO GATEWAY
## For Developers: Implementation Architecture & Revenue Model

---

# 📋 EXECUTIVE OVERVIEW (For Developers)

```
You're building an API Gateway that manages two separate revenue streams:

1. CRYPTO PANEL
   ├─ You control master wallets (BTC, ETH, SOL, etc.)
   ├─ Clients get virtual accounts (DB entries, read-only)
   ├─ You take 100% of all commissions
   └─ Revenue: Gas markup (40%) + Internal swaps (0.5%)

2. RWA PANEL
   ├─ Each client brings their own token/asset
   ├─ You provide infrastructure + trading platform
   ├─ You take 100% of all commissions on their token
   ├─ Client pays: Setup fee ($500) + Annual fee ($200)
   └─ Revenue: Gas markup (40%) + Swaps (0.5%) + Trading volume (0.5%)

Total: You earn on BOTH panels, no revenue sharing with clients
```

---

# 🗄️ DATABASE SCHEMA ARCHITECTURE

## Panel 1: CRYPTO (Your Control)

```typescript
// Master Wallets (You own & control)
master_wallets_crypto {
  id: UUID (primary key)
  blockchain: 'bitcoin' | 'ethereum' | 'solana' | 'polygon'
  assetName: 'BTC' | 'ETH' | 'SOL' | 'MATIC'
  address: text (public address)
  privateKeyEncrypted: text (AES-256 encrypted)
  privateKeyIv: text (IV for decryption)
  balance: decimal
  balanceUsd: decimal
  lastSyncTime: timestamp
  status: 'active' | 'suspended'
  createdAt: timestamp
}

// Virtual Accounts (Client balances)
virtual_accounts_crypto {
  id: UUID
  tenantId: UUID (references tenants table)
  accountType: 'individual' | 'business'
  balances: JSONB {
    "BTC": "1.5",
    "ETH": "10.0",
    "SOL": "100.0"
  }
  status: 'active' | 'frozen'
  createdAt: timestamp
}

// Transactions (Internal swaps + External withdrawals)
crypto_transactions {
  id: UUID
  tenantId: UUID
  type: 'internal_swap' | 'external_withdraw' | 'external_deposit'
  
  // For internal swaps
  fromAccountId: UUID
  toAccountId: UUID
  
  // For external
  toExternalAddress: text
  
  // Asset info
  assetName: 'BTC' | 'ETH' | 'SOL'
  blockchain: 'bitcoin' | 'ethereum' | 'solana'
  amount: decimal
  
  // Your revenue tracking
  gasReal: decimal (actual blockchain gas)
  gasMarkupPercent: integer (40 by default)
  gasCharged: decimal (what you charge)
  yourProfit: decimal (gas charged - gas real)
  
  commissionAmount: decimal (0.5% from swaps)
  commissionUsd: decimal
  
  status: 'pending' | 'confirmed' | 'failed'
  txHash: text (on-chain hash if external)
  createdAt: timestamp
}
```

## Panel 2: RWA (Client Control, Your Monetization)

```typescript
// RWA Clients (Companies issuing tokens)
rwa_clients {
  id: UUID
  tenantId: UUID (the company)
  tokenId: string ('GOLD', 'SILVER', 'COPPER')
  tokenName: string
  blockchain: 'ethereum' | 'polygon' | 'solana'
  smartContractAddress: text (ERC-20 address)
  
  // Your fees
  setupFeePaid: boolean
  setupFeeAmount: decimal (500)
  annualFeeAmount: decimal (200)
  
  status: 'active' | 'paused' | 'archived'
  createdAt: timestamp
}

// Master Wallet per RWA Token
rwa_master_wallets {
  id: UUID
  rwaClientId: UUID (references rwa_clients)
  blockchain: 'ethereum' | 'polygon' | 'solana'
  address: text (public address)
  privateKeyEncrypted: text (AES-256)
  privateKeyIv: text
  balance: decimal
  balanceUsd: decimal
  lastSyncTime: timestamp
  createdAt: timestamp
}

// Virtual Accounts per RWA Token (Sub-clients)
rwa_virtual_accounts {
  id: UUID
  rwaClientId: UUID
  subClientId: text (who owns this)
  tokenId: string ('GOLD', 'SILVER')
  balance: decimal
  balances: JSONB { "GOLD": "100.5", "SILVER": "50.0" }
  status: 'active' | 'frozen'
  createdAt: timestamp
}

// Transactions per RWA Token
rwa_transactions {
  id: UUID
  rwaClientId: UUID
  type: 'internal_swap' | 'external_withdraw' | 'external_deposit'
  
  // Parties
  fromAccountId: UUID
  toAccountId: UUID
  toExternalAddress: text
  
  // Asset
  tokenId: string ('GOLD')
  blockchain: 'ethereum'
  amount: decimal
  
  // YOUR REVENUE (100% to you)
  gasReal: decimal
  gasMarkupPercent: integer (40)
  gasCharged: decimal
  yourProfit: decimal
  
  commissionAmount: decimal (0.5% of swaps)
  commissionUsd: decimal
  
  // Volume commission (0.5%)
  volumeCommission: decimal
  
  status: 'pending' | 'confirmed' | 'failed'
  txHash: text
  createdAt: timestamp
}

// Revenue Aggregation (For invoicing & tracking)
rwa_revenue_aggregation {
  id: UUID
  rwaClientId: UUID
  period: string ('2024-12')
  
  setupFeesReceived: decimal
  annualFeesReceived: decimal
  
  // Your commissions (all revenue from this token)
  gasMarkupEarned: decimal
  swapCommissionEarned: decimal
  volumeCommissionEarned: decimal
  
  totalEarnedThisPeriod: decimal
  totalEarnedAllTime: decimal
  
  createdAt: timestamp
}
```

---

# 🔗 API ENDPOINTS

## CRYPTO PANEL ENDPOINTS (100% Your Revenue)

### 1. Create Virtual Crypto Account

```
POST /api/crypto/accounts/create
Authorization: Bearer {API_KEY}
X-Tenant-ID: {TENANT_ID}

Request:
{
  "accountType": "individual",
  "tier": "starter"
}

Response:
{
  "accountId": "acc-crypto-001",
  "balances": {
    "BTC": "0",
    "ETH": "0",
    "SOL": "0"
  },
  "status": "active",
  "createdAt": "2024-12-01T10:00:00Z"
}

Backend Logic:
1. Verify API key + tenant
2. Check tier limits
3. Create virtualAccounts_crypto record
4. Initialize empty JSONB balances
5. Return account ID
```

### 2. Get Crypto Account Balance

```
GET /api/crypto/accounts/{accountId}/balance
Authorization: Bearer {API_KEY}

Response:
{
  "accountId": "acc-crypto-001",
  "balances": {
    "BTC": "1.5",
    "ETH": "10.0",
    "SOL": "100.0"
  },
  "balancesUsd": {
    "BTC": 67500,
    "ETH": 25000,
    "SOL": 1000
  },
  "totalUsd": 93500
}

Backend Logic:
1. Query virtual_accounts_crypto
2. Parse JSONB balances
3. Convert to USD using current prices
4. Return formatted response
```

### 3. Internal Crypto Swap

```
POST /api/crypto/swap/internal
Authorization: Bearer {API_KEY}

Request:
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

Response:
{
  "txId": "tx-swap-001",
  "status": "completed",
  "fromAmount": "1.0",
  "toAmount": "15.0",
  "commission": "0.075",      // 0.5% of 15 ETH
  "commissionUsd": "187.50",
  "netReceived": "14.925",
  "executedAt": "2024-12-01T10:05:00Z"
}

Backend Logic:
1. Validate both accounts exist & have balance
2. Check fromAccount balance >= fromAmount
3. Calculate commission: toAmount * 0.5% = commission amount
4. Update fromAccount: balance -= fromAmount
5. Update toAccount: balance += (toAmount - commission)
6. Store commission in your revenue pool
7. Create crypto_transactions record
8. Return success

Revenue Calculation:
├─ Commission: 0.075 ETH
├─ At $1,666.67/ETH = $125
└─ YOUR PROFIT: $125 ✅
```

### 4. External Crypto Withdraw

```
POST /api/crypto/withdraw
Authorization: Bearer {API_KEY}

Request:
{
  "fromAccountId": "acc-crypto-001",
  "toWalletAddress": "0xabcdef1234567890abcdef1234567890abcdef12",
  "assetName": "ETH",
  "blockchain": "ethereum",
  "amount": "0.5",
  "gasPriority": "standard"
}

Response:
{
  "txId": "tx-withdraw-001",
  "status": "pending_confirmation",
  "txHash": "0x1234567890abcdef...",
  "amount": "0.5",
  "blockchain": "ethereum",
  "gasReal": "3.0",
  "gasMarkupPercent": 40,
  "gasCharged": "4.2",
  "yourProfit": "1.2",
  "estimatedTime": "12 seconds",
  "createdAt": "2024-12-01T10:10:00Z"
}

Backend Logic:
1. Find master_wallet_crypto for ETH/ethereum
2. Validate account has 0.5 ETH balance
3. Estimate gas from Tatum: $3.0
4. Calculate markup: 3.0 * 1.4 = 4.2 (40% markup)
5. Your profit: 4.2 - 3.0 = $1.2
6. Update account: balance -= 0.5
7. Call Tatum API to send transaction
8. Capture txHash
9. Create crypto_transactions record with status='pending'
10. Return response

Revenue Calculation:
├─ Gas real: $3.00
├─ Markup 40%: $1.20
├─ YOUR PROFIT: $1.20 ✅
```

---

## RWA PANEL ENDPOINTS (100% Your Revenue)

### 5. Create RWA Client (Client wants to tokenize)

```
POST /api/rwa/clients/create
Authorization: Bearer {ADMIN_KEY}

Request:
{
  "tenantId": "tenant-gold-corp",
  "tokenId": "GOLD",
  "tokenName": "Gold Token",
  "blockchain": "ethereum",
  "totalSupply": "1000000"
}

Response:
{
  "rwaClientId": "rwa-001",
  "tokenId": "GOLD",
  "masterAddress": "0xAAAA...",
  "setupFeeRequired": 500,
  "annualFee": 200,
  "status": "pending_setup_fee",
  "createdAt": "2024-12-01T11:00:00Z"
}

Backend Logic:
1. Validate admin key
2. Create rwa_clients record
3. Generate master wallet for token
4. Deploy smart contract (ERC-20)
5. Initial mint to master address
6. Return setup fee invoice
7. Set status to 'pending_setup_fee' until paid
```

### 6. RWA Internal Swap (Client's sub-users trading)

```
POST /api/rwa/swap/internal/{rwaClientId}
Authorization: Bearer {API_KEY}

Request:
{
  "fromAccountId": "rwa-sub-account-1",
  "toAccountId": "rwa-sub-account-2",
  "fromToken": "GOLD",
  "toToken": "SILVER",
  "fromAmount": "100",
  "toAmount": "200",
  "rate": 2.0
}

Response:
{
  "txId": "rwa-swap-001",
  "status": "completed",
  "swap": "100 GOLD → 200 SILVER",
  "commission": "1.0",           // 0.5% of 200 SILVER
  "commissionUsd": "50.00",
  "netReceived": "199.0",
  "yourProfit": "50.00",
  "executedAt": "2024-12-01T11:05:00Z"
}

Backend Logic:
1. Verify rwaClientId matches API key tenant
2. Validate both sub-accounts exist
3. Check fromAccount has 100 GOLD
4. Calculate commission: 200 * 0.5% = 1 SILVER
5. Update fromAccount: GOLD -= 100
6. Update toAccount: SILVER += 199
7. Store YOUR commission (1 SILVER) in revenue pool
8. Create rwa_transactions record
9. Return success

Revenue Calculation:
├─ Commission: 1 SILVER
├─ At $50/SILVER = $50
└─ YOUR PROFIT: $50 ✅ (100% to you, not client)
```

### 7. RWA External Withdraw (Sub-user sends token to external wallet)

```
POST /api/rwa/withdraw/{rwaClientId}
Authorization: Bearer {API_KEY}

Request:
{
  "fromAccountId": "rwa-sub-account-1",
  "toWalletAddress": "0xBBBB...",
  "tokenId": "GOLD",
  "amount": "50"
}

Response:
{
  "txId": "rwa-withdraw-001",
  "status": "pending_confirmation",
  "txHash": "0x9999...",
  "token": "GOLD",
  "amount": "50",
  "blockchain": "ethereum",
  "gasReal": "5.0",
  "gasMarkupPercent": 40,
  "gasCharged": "7.0",
  "yourProfit": "2.0",
  "createdAt": "2024-12-01T11:10:00Z"
}

Backend Logic:
1. Verify rwaClientId matches API key
2. Find rwa_master_wallet for GOLD/ethereum
3. Validate account has 50 GOLD
4. Estimate gas for ERC-20 transfer: $5
5. Calculate markup: 5 * 1.4 = 7 (40% markup)
6. Your profit: 7 - 5 = $2
7. Update account: GOLD -= 50
8. Call Tatum to send ERC-20 transfer
9. Create rwa_transactions record
10. Return response

Revenue Calculation:
├─ Gas real: $5.00
├─ Markup 40%: $2.00
├─ YOUR PROFIT: $2.00 ✅ (100% to you)
```

---

# 💰 REVENUE TRACKING SYSTEM

## Monthly Revenue Report (Crypto Panel)

```
GET /api/admin/revenue/crypto?period=2024-12
Authorization: Bearer {ADMIN_KEY}

Response:
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
    "averageCommission": 14.50
  }
}

Backend Logic:
1. Query crypto_transactions for period
2. Filter by type and calculate sums
3. Group by transaction type
4. Calculate revenue per type
5. Aggregate costs (infrastructure, team)
6. Return formatted report
```

## Monthly Revenue Report (RWA Panel)

```
GET /api/admin/revenue/rwa?period=2024-12
Authorization: Bearer {ADMIN_KEY}

Response:
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
        "commission": 50,
        "yourEarnings": 50
      },
      
      "gasMarkup": {
        "totalTransactions": 100,
        "averageGas": 5,
        "earned": 200
      },
      
      "tradingVolume": {
        "volume": 500000,
        "commissionRate": 0.5,
        "earned": 2500
      },
      
      "clientTotalThisMonth": 2750,
      "yourTotalThisMonth": 2750  // 100% to you
    },
    // ... more clients
  ],
  
  "totalEarned": 87500,
  "costs": 15000,
  "netProfit": 72500,
  "profitMargin": 0.828
}

Backend Logic:
1. Query rwa_revenue_aggregation for period
2. Calculate setup + annual fees
3. For each RWA client, sum:
   ├─ Swap commissions (0.5%)
   ├─ Gas markup (40%)
   ├─ Trading volume (0.5%)
4. Aggregate all clients
5. Calculate total profit
6. Return detailed breakdown
```

---

# 🎯 TRANSACTION FLOW DIAGRAMS

## Crypto Panel - Internal Swap

```
Timeline:
t=0s: User initiates swap
     POST /api/crypto/swap/internal
     └─ {fromAmount: 1 BTC, toAmount: 15 ETH}

t=0.1s: Backend processes
     ├─ Read fromAccount balance
     ├─ Verify 1 BTC available
     ├─ Calculate commission: 15 * 0.5% = 0.075 ETH
     ├─ Update fromAccount: BTC -= 1
     ├─ Update toAccount: ETH += 14.925
     ├─ Store commission in revenue pool
     └─ Create transaction record

t=0.2s: Response returned
     {
       "status": "completed",
       "commission": "0.075 ETH",
       "yourProfit": "$125"
     }

ZERO blockchain interactions
INSTANT execution
100% revenue to you
```

## RWA Panel - Token Launch to Revenue

```
Week 1: Client Setup
├─ POST /api/rwa/clients/create
├─ Deploy smart contract
├─ Create master wallet
├─ Invoice setup fee ($500)
└─ Status: pending_setup_fee

Week 2: Client Pays Setup Fee
├─ Setup fee received: $500 ✅
├─ Status: active
└─ Client starts ICO

Week 3-4: Trading Begins
├─ 100 sub-clients join
├─ Daily volume: ~$50K
├─ Your daily revenue:
│  ├─ Swaps (0.5%): $250
│  ├─ Gas (40%): $200
│  ├─ Trading (0.5%): $250
│  └─ Daily: $700
└─ Monthly: $21,000

Month 2+: Recurring Revenue
├─ Annual fee: $200 ✅
├─ Monthly commissions: $21,000
├─ Total monthly: $21,200
└─ Annualized: $254,400 per client

With 100 clients by Year 2:
└─ $254,400 × 100 = $25.4M/year
```

---

# 🔐 ADMIN SETTINGS & CONTROL

## Gas Fee Configuration (Real-Time)

```
GET /api/admin/gas-settings
Authorization: Bearer {ADMIN_KEY}

Response:
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
  },
  
  "transactionTypeOverrides": {
    "crypto_withdraw": 40,
    "token_transfer": 45,
    "smart_contract": 60
  }
}

Update Gas Markup:
PUT /api/admin/gas-settings
Authorization: Bearer {ADMIN_KEY}

Request:
{
  "setting": "globalDefaultMarkup",
  "value": 45,
  "effectiveImmediately": true
}

Response:
{
  "success": true,
  "previousValue": 40,
  "newValue": 45,
  "appliedAt": "2024-12-01T12:00:00Z"
}
```

---

# 📊 REVENUE EXAMPLE (Real Numbers)

## Year 1 - Crypto Panel

```
Assumptions:
├─ 1,000 active clients
├─ Average 10 withdrawals per month
├─ Average gas: $3 per transaction
├─ Internal swaps: $1M monthly volume

Calculations:
├─ Gas fee revenue:
│  ├─ Transactions: 1,000 × 10 = 10,000/month
│  ├─ Gas real: 10,000 × $3 = $30,000
│  ├─ Markup 40%: $30,000 × 0.4 = $12,000
│  └─ Monthly: $12,000
│
└─ Internal swap commissions:
   ├─ Monthly volume: $1,000,000
   ├─ Commission 0.5%: $5,000
   └─ Monthly: $5,000

Total Monthly Crypto: $17,000
Total Annual Crypto: $204,000
```

## Year 1 - RWA Panel (20 Clients)

```
Per Client Assumptions:
├─ Average sub-clients: 100
├─ Monthly volume: $500,000
├─ Transaction mix:
│  ├─ Internal swaps: $10,000
│  ├─ Gas fees: 100 × $3 = $300
│  └─ Trading volume: $500,000

Per Client Monthly Revenue (ALL TO YOU):
├─ Setup fee (once): $500
├─ Annual fee (1/12): $16.67
├─ Internal swaps 0.5%: $50
├─ Gas markup 40%: $120
├─ Trading volume 0.5%: $2,500
└─ Monthly: $2,686.67

20 Clients:
├─ Monthly: $2,686.67 × 20 = $53,733.40
└─ Annual: $644,800.80

Total Year 1: $204,000 (crypto) + $644,800 (RWA) = $848,800

Year 1 Profit:
├─ Revenue: $848,800
├─ Costs: $150,000
└─ PROFIT: $698,800 (82.3% margin) ✅
```

---

# ✅ IMPLEMENTATION CHECKLIST

```
Phase 1: Database Setup
├─ [ ] Create master_wallets_crypto table
├─ [ ] Create virtual_accounts_crypto table
├─ [ ] Create crypto_transactions table
├─ [ ] Create rwa_clients table
├─ [ ] Create rwa_master_wallets table
├─ [ ] Create rwa_virtual_accounts table
├─ [ ] Create rwa_transactions table
└─ [ ] Create gas_settings table

Phase 2: Crypto Panel APIs
├─ [ ] POST /api/crypto/accounts/create
├─ [ ] GET /api/crypto/accounts/{id}/balance
├─ [ ] POST /api/crypto/swap/internal
├─ [ ] POST /api/crypto/withdraw
└─ [ ] GET /api/crypto/transactions/{id}

Phase 3: RWA Panel APIs
├─ [ ] POST /api/rwa/clients/create
├─ [ ] POST /api/rwa/swap/internal/{clientId}
├─ [ ] POST /api/rwa/withdraw/{clientId}
└─ [ ] POST /api/rwa/transactions/{id}

Phase 4: Admin APIs
├─ [ ] GET /api/admin/gas-settings
├─ [ ] PUT /api/admin/gas-settings
├─ [ ] GET /api/admin/revenue/crypto
├─ [ ] GET /api/admin/revenue/rwa
└─ [ ] POST /api/admin/masters/assign

Phase 5: Revenue Tracking
├─ [ ] Monthly commission aggregation
├─ [ ] Real-time revenue dashboard
├─ [ ] Client invoicing system
└─ [ ] Payout reconciliation

Phase 6: Security & Monitoring
├─ [ ] Private key encryption (AES-256)
├─ [ ] Rate limiting per tenant
├─ [ ] Audit logging all transactions
└─ [ ] Alert system for anomalies
```

---

# 🎓 DEVELOPER TAKEAWAY

```
YOU'RE BUILDING:

├─ CRYPTO PANEL
│  └─ Master wallets you control
│  └─ Clients use virtual accounts
│  └─ You earn 100% of commissions
│  └─ No sharing, no exceptions
│
└─ RWA PANEL
   └─ Clients bring their assets/tokens
   └─ You provide infrastructure
   └─ You earn 100% of commissions
   └─ Client pays setup + annual fee
   └─ Revenue scales with their volume

REVENUE = VOLUME × COMMISSION_RATE
No intermediaries, all revenue is yours
```

This is the complete technical specification. Build it.
