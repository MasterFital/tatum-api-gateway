# 🚀 Tatum API Gateway - Complete Implementation Guide

**Version:** 1.0.0 Production  
**Status:** ✅ Live & Ready  
**Based On:** Tatum API v3/v4 (https://docs.tatum.io)  
**Authentication:** x-api-key header (Tatum v3 recommended)

---

## 📚 Quick Navigation

1. [Business Model Overview](#business-model-overview)
2. [Architecture & Integration](#architecture--integration)
3. [Authentication Guide](#authentication-guide)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [CRYPTO Panel Usage](#crypto-panel-usage)
6. [RWA Panel Usage](#rwa-panel-usage)
7. [Admin Dashboard](#admin-dashboard)
8. [Real-World Examples](#real-world-examples)
9. [Error Handling & Resilience](#error-handling--resilience)

---

## 🏢 Business Model Overview

### How Revenue is Generated (100% to Admin)

Your API Gateway monetizes blockchain services through two distinct panels:

| Feature | CRYPTO Panel | RWA Panel |
|---------|-------------|-----------|
| **Client Use Case** | Trade crypto, withdraw funds | Tokenize real-world assets |
| **Admin Revenue** | 0.5% swap commission + 40% gas markup | $500 setup + $200/year + 0.5% trading |
| **Year 1 Revenue** | ~$204K | ~$654K |
| **Year 3 Revenue** | ~$2.04M | ~$60.21M |
| **Profit Margin** | 82.5% → 96.8% | Scales exponentially |

### Revenue Streams Breakdown

#### CRYPTO Panel (Internal Operations)

**1. Internal Swap Commission (0.5%)**
- Client swaps: 1 BTC → 15.5 ETH (on your platform)
- **Admin earns:** 0.0775 ETH (0.5% of 15.5 ETH)
- **Why profitable:** Zero blockchain gas cost, instant settlement
- **Example:** $1M monthly swap volume = $5K monthly revenue

**2. External Withdrawal Markup (40% on Gas)**
- Client withdraws: 1 ETH to external wallet
- Real Tatum gas cost: $3 USD
- Client charged: $4.20 USD (40% markup)
- **Admin earns:** $1.20 per transaction
- **Why profitable:** Pure profit after Tatum's gas cost
- **Example:** 100 withdrawals/day × $1.20 = $43.8K/month

#### RWA Panel (Real-World Assets)

**1. Setup Fee ($500 per token)**
- Client creates real estate/commodity token
- **Admin earns:** $500 (one-time, immediate)
- **Cost to admin:** ~$0.10 (Tatum blockchain deployment)
- **ROI:** 5000x per token

**2. Annual Maintenance Fee ($200/year)**
- Per active token on your platform
- **Admin earns:** $200 recurring revenue
- **Effort:** Automated via smart contracts

**3. Trading Commission (0.5% of volume)**
- Clients trade tokens on your platform
- **Admin earns:** 0.5% of every trade
- **Why powerful:** Scales infinitely with trading volume
- **Example:** 100 tokens × $100K monthly volume each = $50K commission/month

---

## 🏗️ Architecture & Integration

### How It Works

```
┌─────────────────┐
│  Client App     │ (Web/Mobile)
└────────┬────────┘
         │ (x-api-key header)
         │
┌────────▼────────────────────────┐
│   Your API Gateway              │
│  (Express + TypeScript)          │
│                                 │
│  ├─ Virtual Accounts (Client)    │
│  ├─ Swaps (0.5% commission)      │
│  ├─ Withdrawals (40% gas markup) │
│  ├─ Tokens (RWA)                 │
│  └─ Revenue Tracking (Admin)     │
└────────┬────────────────────────┘
         │ (x-api-key Tatum auth)
         │
┌────────▼──────────────────────────┐
│   Tatum API v3/v4                 │
│   (https://api.tatum.io)          │
│                                   │
│  ├─ 130+ Blockchains              │
│  ├─ Address Generation            │
│  ├─ Transaction Broadcasting      │
│  ├─ Gas Estimation                │
│  ├─ Balance Queries               │
│  └─ Smart Contracts               │
└────────┬──────────────────────────┘
         │
┌────────▼──────────────────────────┐
│   Blockchains                     │
│   (Bitcoin, Ethereum, Polygon,    │
│    Solana, etc. - 130+ total)     │
└───────────────────────────────────┘
```

### Security & Resilience

Your gateway implements production-grade resilience:

**Circuit Breaker Pattern**
- Monitors Tatum API health
- Opens circuit after 5 consecutive failures
- Auto-recovers after 60 seconds
- Prevents cascading failures

**Retry Logic with Exponential Backoff**
- Max 3 retry attempts
- Base delay: 1 second
- Max delay: 30 seconds
- Handles rate limits (429), timeouts (408), and server errors (5xx)

**Request Timeouts**
- 30-second timeout per request
- Prevents indefinite hanging
- Returns clear error messages

**Tatum API Key Validation**
- Validates key format (min 32 chars, alphanumeric)
- Warns on startup if misconfigured
- Supports custom Tatum URLs via environment variables

---

## 🔐 Authentication Guide

### How Authentication Works

All API requests require **TWO** authentication methods:

#### 1. Client Authentication (x-api-key header)

Used by clients to access their own resources.

```bash
curl -H "x-api-key: tatum_xxxxxxxxxxxxxxxxxxxxx" \
  https://your-gateway.vercel.app/api/v1/gateway/virtual-accounts
```

**How to get a client API key:**

```bash
# 1. Create tenant (new client)
curl -X POST https://your-gateway.vercel.app/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "email": "contact@mycompany.com",
    "tier": "starter"
  }'

# Response includes ONE-TIME API key (save immediately):
{
  "apiKey": "tatum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

⚠️ **Important:** API keys are shown ONLY once. If lost, rotate via:

```bash
curl -X POST \
  -H "x-api-key: OLD_API_KEY" \
  https://your-gateway.vercel.app/api/tenants/:id/rotate-key
```

#### 2. Admin Authentication (x-admin-key header)

Used by admin to view revenue, change tiers, configure gas markup.

```bash
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  https://your-gateway.vercel.app/api/admin/revenue
```

**How to set up admin key:**

```bash
# In your .env file:
ADMIN_API_KEY=admin_xxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Generate a secure admin key:
```bash
openssl rand -hex 32
```

### Rate Limiting by Tier

**Starter (Free)**
- 10 requests/sec
- 50 max addresses
- 10,000 monthly quota

**Scale ($99/month)**
- 100 requests/sec
- 1,000 max addresses
- 100,000 monthly quota

**Enterprise (Custom)**
- 1,000 requests/sec
- Unlimited addresses
- Unlimited quota

---

## 📡 API Endpoints Reference

### Public Endpoints (No Auth Required)

#### `GET /` - API Gateway Overview

Shows business model and all available endpoints.

```bash
curl https://your-gateway.vercel.app/
```

**Response:**
```json
{
  "name": "Tatum API Gateway",
  "version": "1.0.0",
  "status": "running",
  "businessModel": {
    "cryptoPanel": "Master wallet with 0.5% swap + 40% gas markup",
    "rwaPanel": "$500 setup + $200/year + 0.5% trading"
  },
  "endpoints": {
    "health": "GET /api/health",
    "pricing": "GET /api/pricing",
    "chains": "GET /api/chains",
    "crypto": "POST /api/v1/gateway/virtual-accounts, /api/v1/gateway/swap, /api/v1/gateway/withdraw",
    "rwa": "POST /api/v1/rwa/tokens, GET /api/v1/rwa/tokens, POST /api/v1/rwa/tokens/:id/transfer"
  }
}
```

#### `GET /api/health` - System Health Check

Verifies all systems are operational, including Tatum connection.

```bash
curl https://your-gateway.vercel.app/api/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "api": "healthy",
    "database": "healthy",
    "tatum": "healthy"  // Green light to proceed with transactions
  }
}
```

#### `GET /api/chains` - Supported Blockchains

Lists all 130+ blockchains supported via Tatum.

```bash
curl https://your-gateway.vercel.app/api/chains
```

**Response:**
```json
{
  "success": true,
  "chains": [
    "bitcoin", "ethereum", "polygon", "solana", "bsc",
    "arbitrum", "optimism", "cardano", "near", "ripple",
    // ... 120+ more
  ],
  "total": 130
}
```

**Tatum Reference:** https://docs.tatum.io/docs/supported-blockchains

#### `GET /api/pricing` - Tier Information

Shows all tier options and limits.

```bash
curl https://your-gateway.vercel.app/api/pricing
```

---

### Tenant Management Endpoints (x-api-key required)

#### `GET /api/tenants/:id` - Get Tenant Details

Get your account status, usage, and quota remaining.

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://your-gateway.vercel.app/api/tenants/tenant-123
```

**Response:**
```json
{
  "success": true,
  "tenant": {
    "id": "tenant-123",
    "name": "My Company",
    "tier": "starter",
    "usage": {
      "requests": 5432,
      "units": 2156,
      "costUsd": "21.56",
      "quota": {
        "used": 5432,
        "remaining": 4568,
        "percentUsed": 54
      }
    }
  }
}
```

#### `PATCH /api/tenants/:id` - Update Profile

Update company name, website, billing email.

```bash
curl -X PATCH \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "website": "https://example.com",
    "billingEmail": "billing@example.com"
  }' \
  https://your-gateway.vercel.app/api/tenants/tenant-123
```

#### `POST /api/tenants/:id/rotate-key` - Rotate API Key

Invalidate old key and generate a new one (old key stops working immediately).

```bash
curl -X POST \
  -H "x-api-key: YOUR_OLD_API_KEY" \
  https://your-gateway.vercel.app/api/tenants/tenant-123/rotate-key
```

**Response:**
```json
{
  "success": true,
  "apiKey": "tatum_new_key_xxxxxxxxxxxxxxxxxxxxxxxx",
  "warning": "Old key is now invalid. Use new key for all future requests."
}
```

---

## 💰 CRYPTO Panel Usage

The CRYPTO panel lets clients hold crypto and earn you revenue through swaps and withdrawals.

### Step 1: Create Virtual Account

Client creates an account to hold crypto.

**Request:**
```bash
curl -X POST \
  -H "x-api-key: CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "accountType": "crypto" }' \
  https://your-gateway.vercel.app/api/v1/gateway/virtual-accounts
```

**Response:**
```json
{
  "success": true,
  "virtualAccount": {
    "id": "va-123",
    "accountType": "crypto",
    "balances": {},
    "status": "active"
  }
}
```

### Step 2: Client Performs Internal Swap (0.5% Commission to You)

Client swaps one asset for another instantly without blockchain gas.

**Scenario:** Client trades 1 BTC for ETH

**Request:**
```bash
curl -X POST \
  -H "x-api-key: CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccountId": "va-123",
    "toAccountId": "va-123",
    "assetName": "BTC",
    "blockchain": "bitcoin",
    "fromAmount": "1.0",
    "toAmount": "15.5",
    "rate": 15500
  }' \
  https://your-gateway.vercel.app/api/v1/gateway/swap
```

**Response:**
```json
{
  "success": true,
  "swap": {
    "txId": "swap-789",
    "status": "completed",
    "fromAmount": "1.0 BTC",
    "toAmount": "15.5 ETH",
    "commission": "0.0775 ETH (0.5% to YOU)",
    "netReceived": "15.4225 ETH",
    "executedAt": "2024-11-30T10:00:00Z"
  }
}
```

**💰 Your Revenue:** 0.0775 ETH ≈ $193.75 (pure profit, no gas cost)

### Step 3: Client Performs External Withdrawal (40% Gas Markup to You)

Client withdraws to their external wallet, you earn markup on gas.

**Scenario:** Client withdraws 1 ETH to external address

**Request:**
```bash
curl -X POST \
  -H "x-api-key: CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccountId": "va-123",
    "toExternalAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "assetName": "ETH",
    "blockchain": "ethereum",
    "amount": "1.0"
  }' \
  https://your-gateway.vercel.app/api/v1/gateway/withdraw
```

**Response:**
```json
{
  "success": true,
  "withdraw": {
    "txId": "withdraw-999",
    "status": "pending_confirmation",
    "txHash": "0xabcd...",
    "amount": "1.0 ETH",
    "gasReal": "$3.00",
    "gasCharged": "$4.20 (40% markup)",
    "yourProfit": "$1.20 (pure profit)",
    "estimatedTime": "12 seconds"
  }
}
```

**💰 Your Revenue:** $1.20 per transaction (scales infinitely)

**Tatum Reference:** https://docs.tatum.io/docs/transactions

---

## 🪙 RWA Panel Usage

The RWA panel lets clients create and trade real-world asset tokens. You earn fees from every step.

### Step 1: Create RWA Token ($500 Setup Fee)

Client creates a new token (e.g., real estate fund). You collect $500 immediately.

**Request:**
```bash
curl -X POST \
  -H "x-api-key: CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "assetName": "Downtown Office Building",
    "symbol": "DOFF",
    "blockchain": "ethereum",
    "decimals": 18,
    "totalSupply": "1000000",
    "issuerName": "Downtown RE Corp",
    "description": "Tokenized commercial real estate"
  }' \
  https://your-gateway.vercel.app/api/v1/rwa/tokens
```

**Response:**
```json
{
  "success": true,
  "token": {
    "id": "token-doff-1",
    "symbol": "DOFF",
    "blockchain": "ethereum",
    "smartContractAddress": "0x...",
    "status": "created"
  },
  "pricing": {
    "setupFee": "$500 (one-time) ✅ PAID TO YOU",
    "annualFee": "$200/year ✅ PAID TO YOU",
    "tradingCommission": "0.5% on all trades ✅ 100% TO YOU"
  }
}
```

**💰 Your Revenue:**
- **Immediate:** $500 setup fee
- **Recurring:** $200/year annual maintenance
- **Per trade:** 0.5% of trading volume

### Step 2: View Token Trading Volume

Track how much clients are trading and your commission earnings.

**Request:**
```bash
curl -H "x-api-key: CLIENT_API_KEY" \
  https://your-gateway.vercel.app/api/v1/rwa/tokens
```

**Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "id": "token-doff-1",
      "symbol": "DOFF",
      "totalSupply": "1000000",
      "status": "active",
      "tradingVolume": "$250K",
      "tradingCommission": "$1250 (0.5% of volume) ✅ TO YOU"
    }
  ],
  "summary": {
    "totalTokens": 1,
    "totalTradingCommissions": "$1250 ✅ 100% TO YOU",
    "setupFeesCollected": "$500 ✅ 100% TO YOU"
  }
}
```

### Step 3: Monitor Token Transfers (0.5% Commission)

Every time someone trades tokens, you earn 0.5%.

**Scenario:** Token holder transfers 100 DOFF tokens

```bash
curl -X POST \
  -H "x-api-key: CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "toAddress": "0xabcd1234...",
    "amount": "100"
  }' \
  https://your-gateway.vercel.app/api/v1/rwa/tokens/token-doff-1/transfer
```

**Response:**
```json
{
  "success": true,
  "transfer": {
    "id": "transfer-123",
    "amount": "100 DOFF",
    "commission": "0.5 DOFF (0.5% to YOU) ✅",
    "status": "completed",
    "txHash": "0x..."
  }
}
```

**💰 Your Revenue:** 0.5 DOFF per trade (scales with trading volume)

**Tatum Reference:** https://docs.tatum.io/docs/smart-contracts

---

## 📊 Admin Dashboard

View all revenue and manage client tiers.

### Get Crypto Revenue Metrics

View all earnings from swaps and withdrawals.

```bash
curl -H "x-admin-key: ADMIN_KEY" \
  https://your-gateway.vercel.app/api/admin/revenue
```

**Response:**
```json
{
  "success": true,
  "revenue": {
    "total": {
      "allTime": "4702.45",
      "swapCommissions": "1245.67",
      "gasMarkupRevenue": "3456.78"
    },
    "breakdown": {
      "byBlockchain": {
        "ethereum": "2345.67",
        "polygon": "1234.56",
        "bitcoin": "3456.78"
      }
    },
    "rates": {
      "swapCommissionRate": "0.5%",
      "defaultGasMarkup": "40%"
    }
  }
}
```

### Get RWA Revenue Metrics

View all fees and commissions from tokens.

```bash
curl -H "x-admin-key: ADMIN_KEY" \
  https://your-gateway.vercel.app/api/admin/rwa-revenue
```

**Response:**
```json
{
  "success": true,
  "rwaRevenue": {
    "setupFees": {
      "count": 12,
      "total": "$6000"
    },
    "annualFees": {
      "activeClients": 12,
      "total": "$2400"
    },
    "tradingCommissions": {
      "thisMonth": "$12500",
      "thisYear": "$125000"
    },
    "totalMonthlyRevenue": "$15000"
  }
}
```

### Update Gas Markup (Profitability Control)

Adjust the gas fee markup globally or per client.

**Global change (affects all clients):**
```bash
curl -X PUT \
  -H "x-admin-key: ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "markup": 50 }' \
  https://your-gateway.vercel.app/api/admin/gas-settings/global
```

**Per-client override (e.g., VIP discount):**
```bash
curl -X PUT \
  -H "x-admin-key: ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "markup": 30,
    "reason": "VIP partnership",
    "expiresAt": "2025-12-31T23:59:59Z"
  }' \
  https://your-gateway.vercel.app/api/admin/gas-settings/client/tenant-123
```

---

## 🌍 Real-World Examples

### Example 1: Trading Desk Uses Your API

**Scenario:**
- Hedge fund needs to execute 50 BTC ↔ ETH swaps daily
- Each swap averages $500K
- Uses your CRYPTO panel

**Daily Revenue (50 swaps × $500K):**
- Volume: $25M daily
- Swap commission (0.5%): $125K daily ✅
- Annual: $45.625M (just from swaps!)

### Example 2: Real Estate Tokenization Startup

**Scenario:**
- Company launches 5 real estate tokens
- Each token generates $500K trading volume/month

**Monthly Revenue:**
- Setup fees: 5 × $500 = $2,500 ✅
- Annual fees: 5 × $200 = $1,000 ✅
- Trading commissions: $25K (0.5% of $5M volume) ✅
- **Monthly total: $26,500**
- **Annual total: $318,000** (Year 1, growing exponentially)

### Example 3: Multi-Service Provider

**Scenario:**
- 100 clients using both CRYPTO and RWA panels
- Average: $50K monthly swap volume + $100K token trading volume
- 10 active tokens per client

**Monthly Revenue:**
- Swap commissions: 100 clients × $250 = $25K ✅
- Gas markup: 100 clients × $600 = $60K ✅
- Setup fees (new tokens): Avg 5/month × $500 = $2,500 ✅
- Annual fees: 100 clients × 10 tokens × $200/12 = $16,667 ✅
- Trading commissions: 100 clients × $500 = $50K ✅
- **Monthly total: ~$154K**
- **Annual total: ~$1.848M**

---

## 🛡️ Error Handling & Resilience

### Common Error Scenarios

**API Key Invalid**
```json
{ "error": "Invalid API key", "statusCode": 401 }
```

**Rate Limit Exceeded**
```json
{ "error": "Rate limit exceeded (10/sec for starter tier)", "statusCode": 429 }
```

**Tatum API Unavailable (Circuit Breaker Active)**
```json
{ "error": "Service temporarily unavailable (circuit breaker open)", "statusCode": 503 }
```

**Insufficient Balance**
```json
{ "error": "Insufficient balance for transaction", "statusCode": 400 }
```

### How Resilience Works

1. **Circuit Breaker:** After 5 failures, temporarily blocks requests
2. **Automatic Recovery:** Resets after 60 seconds with test request
3. **Retry Logic:** 3 automatic retries with exponential backoff
4. **Timeout Protection:** 30-second limit per request

### Tatum API Best Practices

**Reference:** https://docs.tatum.io/guides/getting-started

1. **Use x-api-key header** (never in URL)
2. **Handle rate limits** (429 status code)
3. **Implement exponential backoff** (already done)
4. **Monitor circuit breaker** (check /api/health)
5. **Test in testnet first** (Tatum supports testnet)

---

## 🚀 Deployment & Configuration

### Environment Variables Required

```bash
# Tatum API
TATUM_API_KEY=your_tatum_production_key
TATUM_API_URL=https://api.tatum.io  # Default

# Admin
ADMIN_API_KEY=admin_key_generated_with_openssl
SESSION_SECRET=secure_session_key

# Database
DATABASE_URL=postgresql://user:pass@host/db
```

### Vercel Deployment

1. Push to GitHub: `git push origin main`
2. Go to Vercel dashboard
3. Add environment variables:
   - `TATUM_API_KEY`
   - `ADMIN_API_KEY`
   - `SESSION_SECRET`
   - `DATABASE_URL`
4. Deploy! 🎉

### Local Testing

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local

# 3. Start development server
npm run dev

# 4. Test endpoints
curl http://localhost:5000/api/health
```

---

## 📖 Additional Tatum Resources

- **Official Docs:** https://docs.tatum.io
- **API Reference:** https://docs.tatum.io/reference/welcome-to-the-tatum-api-reference
- **Testnet Docs:** https://docs.tatum.io/docs/testnet
- **SDKs:** https://docs.tatum.io/docs/sdks
- **Support:** https://tatum.io/support

---

## ✅ Checklist: Getting Started

- [ ] Deploy to Vercel
- [ ] Set environment variables
- [ ] Test `/api/health` endpoint
- [ ] Create first tenant: `POST /api/tenants`
- [ ] Test authentication with API key
- [ ] Create virtual account: `POST /api/v1/gateway/virtual-accounts`
- [ ] Try internal swap: `POST /api/v1/gateway/swap`
- [ ] View revenue: `GET /api/admin/revenue`
- [ ] Set up admin dashboard monitoring
- [ ] Configure gas markup settings

---

**Last Updated:** November 30, 2024  
**Status:** ✅ Production Ready  
**Next Steps:** Deploy to Vercel and start accepting clients!
