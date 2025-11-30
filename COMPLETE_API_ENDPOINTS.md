# Tatum API Gateway - Complete Endpoint Documentation

**Version:** 1.0.0  
**Status:** Production Ready  
**Base URL:** `https://your-vercel-domain.vercel.app`

---

## 📋 Table of Contents
1. [Public Endpoints](#public-endpoints)
2. [Authentication](#authentication)
3. [Tenant Management](#tenant-management)
4. [CRYPTO Panel](#crypto-panel)
5. [RWA Panel](#rwa-panel)
6. [Admin Endpoints](#admin-endpoints)
7. [Real-World Usage Examples](#real-world-usage-examples)

---

## Public Endpoints

### `GET /` - API Gateway Info
Returns complete API information and business model overview.

**Request:**
```bash
curl https://api.example.com/
```

**Response:**
```json
{
  "name": "Tatum API Gateway",
  "version": "1.0.0",
  "status": "running",
  "businessModel": {
    "cryptoPanel": {
      "description": "Master wallet control with 0.5% swap commissions + 40% gas markup",
      "annualRevenue": "$204K (Y1) → $2.04M (Y3)"
    },
    "rwaPanel": {
      "description": "$500 setup + $200/year + 0.5% trading commissions",
      "annualRevenue": "$654K (Y1) → $60.21M (Y3)"
    }
  }
}
```

---

### `GET /api/docs` - Quick Reference
Lists all documentation endpoints and quick access to API info.

**Request:**
```bash
curl https://api.example.com/api/docs
```

**Response:**
```json
{
  "title": "Tatum API Gateway - Complete Documentation",
  "available_docs": {
    "business_model": "GET /api/docs/model - Full explanation of revenue streams",
    "examples": "GET /api/docs/examples - Usage examples for Crypto and RWA",
    "tatum_test": "GET /api/test-tatum - Test connection to Tatum API"
  }
}
```

---

### `GET /api/docs/model` - Business Model Details
Complete breakdown of how revenue is generated from CRYPTO and RWA panels.

**Key Info:**
- **Crypto Panel:** Internal swaps earn 0.5% commission, external withdrawals earn 40% gas markup
- **RWA Panel:** $500 setup fee + $200 annual fee + 0.5% trading commissions on all volume
- **Revenue Share:** 100% goes to admin (you)

---

### `GET /api/docs/examples` - Usage Examples
Shows real examples of how to use Crypto Panel, RWA Panel, and Admin endpoints.

---

### `GET /api/health` - System Health
Checks if API and Tatum connection are healthy.

**Request:**
```bash
curl https://api.example.com/api/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "api": "healthy",
    "database": "healthy",
    "tatum": "healthy"
  },
  "timestamp": "2024-11-30T10:00:00Z"
}
```

---

### `GET /api/pricing` - Tier Pricing
Shows all tier options and their features/pricing.

**Response:**
```json
{
  "success": true,
  "tiers": [
    {
      "id": "starter",
      "maxAddresses": 50,
      "maxWebhooks": 1,
      "rateLimit": 10,
      "monthlyQuota": 10000,
      "pricing": { "monthly": 0 }
    },
    {
      "id": "scale",
      "maxAddresses": 1000,
      "maxWebhooks": 10,
      "rateLimit": 100,
      "monthlyQuota": 100000,
      "pricing": { "monthly": 99 }
    },
    {
      "id": "enterprise",
      "pricing": { "monthly": "custom" }
    }
  ]
}
```

---

### `GET /api/chains` - Supported Blockchains
Lists all 130+ supported blockchains.

**Response:**
```json
{
  "success": true,
  "chains": ["bitcoin", "ethereum", "polygon", "solana", ...],
  "total": 130
}
```

---

### `GET /api/test-tatum` - Test Tatum Connection
Verifies your Tatum API key is configured and working.

**Request:**
```bash
curl https://api.example.com/api/test-tatum
```

**Response:**
```json
{
  "success": true,
  "test": "Tatum API Connection Test",
  "status": {
    "message": "✅ Connected to Tatum API successfully",
    "apiKeyConfigured": true
  }
}
```

---

## Authentication

All authenticated endpoints require the `x-api-key` header with your tenant API key.

### Header Format:
```
x-api-key: tatum_xxxxxxxxxxxxxxxxxxxxx
```

### Rate Limits:
- **Starter:** 10 requests/sec
- **Scale:** 100 requests/sec
- **Enterprise:** 1000 requests/sec (custom)

---

## Tenant Management

### `POST /api/tenants` - Create Tenant
Creates a new tenant account and returns API key (shown ONLY once).

**Request:**
```bash
curl -X POST https://api.example.com/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "email": "contact@mycompany.com",
    "tier": "starter",
    "companyName": "My Company Inc",
    "website": "https://mycompany.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "tenant": {
    "id": "tenant-123",
    "name": "My Company",
    "email": "contact@mycompany.com",
    "tier": "starter",
    "apiKey": "tatum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "hmacSecret": "hmac_secret_xxxxxxxx",
    "limits": {
      "chains": ["bitcoin", "ethereum", "polygon"],
      "maxAddresses": 50,
      "maxWebhooks": 1,
      "rateLimit": 10,
      "monthlyQuota": 10000
    }
  },
  "warning": "Save your API key now. It cannot be retrieved again."
}
```

⚠️ **IMPORTANT:** The API key is shown ONLY once. Save it immediately!

---

### `GET /api/tenants` - List All Tenants
Lists all tenants with usage statistics (public endpoint).

**Response:**
```json
{
  "success": true,
  "tenants": [
    {
      "id": "tenant-123",
      "name": "My Company",
      "tier": "starter",
      "addressCount": 25,
      "usage": {
        "requests": 5432,
        "units": 2156,
        "costUsd": "21.56"
      }
    }
  ]
}
```

---

### `GET /api/tenants/:id` - Get Tenant Details
Get your tenant profile with usage and quota information.

**Headers:**
```
x-api-key: YOUR_API_KEY
```

**Request:**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://api.example.com/api/tenants/tenant-123
```

**Response:**
```json
{
  "success": true,
  "tenant": {
    "id": "tenant-123",
    "name": "My Company",
    "email": "contact@mycompany.com",
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

---

### `PATCH /api/tenants/:id` - Update Tenant Profile
Update your company information (name, website, billing email).

**Request:**
```bash
curl -X PATCH -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Company Name",
    "website": "https://newwebsite.com",
    "billingEmail": "billing@mycompany.com"
  }' \
  https://api.example.com/api/tenants/tenant-123
```

---

### `POST /api/tenants/:id/rotate-key` - Rotate API Key
Generates a new API key and invalidates the old one.

**Request:**
```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  https://api.example.com/api/tenants/tenant-123/rotate-key
```

**Response:**
```json
{
  "success": true,
  "apiKey": "tatum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "warning": "Save your new API key now. The old key is now invalid."
}
```

---

## CRYPTO Panel

The CRYPTO panel allows clients to:
1. **Create virtual accounts** to hold cryptocurrency
2. **Trade internally** (0.5% commission to admin, zero gas fees)
3. **Withdraw externally** (40% gas markup to admin)

### `POST /api/v1/gateway/virtual-accounts` - Create Virtual Account
Creates a virtual crypto account for holding BTC, ETH, SOL, etc.

**Request:**
```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "accountType": "crypto"
  }' \
  https://api.example.com/api/v1/gateway/virtual-accounts
```

**Response:**
```json
{
  "success": true,
  "virtualAccount": {
    "id": "va-123",
    "accountType": "crypto",
    "balances": {},
    "status": "active",
    "createdAt": "2024-11-30T10:00:00Z"
  }
}
```

**Use Case:** Client needs to hold crypto before trading or withdrawing.

---

### `GET /api/v1/gateway/virtual-accounts` - List Virtual Accounts
Lists all virtual accounts for the tenant.

**Request:**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://api.example.com/api/v1/gateway/virtual-accounts
```

**Response:**
```json
{
  "success": true,
  "virtualAccounts": [
    {
      "id": "va-123",
      "accountType": "crypto",
      "balances": { "BTC": "1.5", "ETH": "10.2", "SOL": "50" },
      "status": "active"
    }
  ]
}
```

---

### `GET /api/v1/gateway/virtual-accounts/:id/balance` - Check Account Balance
Get the balance of a virtual account in all assets.

**Request:**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://api.example.com/api/v1/gateway/virtual-accounts/va-123/balance
```

**Response:**
```json
{
  "success": true,
  "balance": {
    "accountId": "va-123",
    "balances": {
      "BTC": "1.5",
      "ETH": "10.2",
      "SOL": "50"
    },
    "totalUsd": 75234.50
  }
}
```

---

### `POST /api/v1/gateway/swap` - Internal Swap (0.5% Commission)
Client trades one asset for another internally (zero gas fees, instant).

**How It Works:**
- Client swaps BTC → ETH
- Transaction is instant (no blockchain)
- **0.5% commission** applied to the received amount and goes to admin
- Client receives net amount after commission

**Request:**
```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccountId": "va-123",
    "toAccountId": "va-456",
    "assetName": "BTC",
    "blockchain": "bitcoin",
    "fromAmount": "1.0",
    "toAmount": "15.5",
    "rate": 15500
  }' \
  https://api.example.com/api/v1/gateway/swap
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
    "commission": "0.0775 ETH (0.5% to admin)",
    "netReceived": "15.4225 ETH",
    "executedAt": "2024-11-30T10:00:00Z"
  },
  "message": "Internal swap completed - zero gas fees, 0.5% commission applied"
}
```

**Revenue Impact:**
- Admin receives: **0.0775 ETH** as commission
- No gas fees (pure profit)

---

### `POST /api/v1/gateway/withdraw` - External Withdraw (40% Gas Markup)
Client withdraws crypto to their external wallet with gas markup.

**How It Works:**
- Client sends 1 ETH to external wallet
- Real gas cost: $3 USD
- Client is charged: $4.20 USD (40% markup)
- Admin profit: **$1.20** (pure profit)

**Request:**
```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccountId": "va-123",
    "toExternalAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "assetName": "ETH",
    "blockchain": "ethereum",
    "amount": "1.0"
  }' \
  https://api.example.com/api/v1/gateway/withdraw
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
    "gasReal": "3 USD",
    "gasCharged": "4.20 USD",
    "yourProfit": "1.20 USD (40% markup)",
    "estimatedTime": "12 seconds"
  },
  "message": "External withdrawal initiated with gas markup applied"
}
```

**Revenue Impact:**
- Admin receives: **$1.20** gas markup per transaction
- Scales infinitely with transaction volume

---

### `GET /api/v1/transactions` - Transaction History
View all internal swaps, withdrawals, and deposits.

**Request:**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://api.example.com/api/v1/transactions?limit=50&offset=0"
```

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "swap-789",
      "type": "internal_swap",
      "asset": "BTC",
      "amount": "1.0",
      "commission": "0.005",
      "status": "completed",
      "createdAt": "2024-11-30T10:00:00Z"
    },
    {
      "id": "withdraw-999",
      "type": "external_withdraw",
      "asset": "ETH",
      "amount": "1.0",
      "gasCharged": "4.20",
      "status": "pending",
      "createdAt": "2024-11-30T10:05:00Z"
    }
  ],
  "pagination": { "total": 42, "limit": 50, "offset": 0 }
}
```

---

## RWA Panel

The RWA (Real-World Assets) panel allows clients to:
1. **Create tokens** ($500 setup fee to admin)
2. **List tokens** and view trading volume
3. **Trade tokens** (0.5% trading commission to admin)

### `POST /api/v1/rwa/tokens` - Create RWA Token
Client creates a new token. Admin collects $500 setup fee.

**Request:**
```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "assetName": "Real Estate Fund",
    "symbol": "REF",
    "blockchain": "ethereum",
    "decimals": 18,
    "totalSupply": "1000000",
    "issuerName": "RE Properties Inc",
    "description": "Tokenized real estate investment fund"
  }' \
  https://api.example.com/api/v1/rwa/tokens
```

**Response:**
```json
{
  "success": true,
  "token": {
    "id": "token-ref-1",
    "assetName": "Real Estate Fund",
    "symbol": "REF",
    "blockchain": "ethereum",
    "totalSupply": "1000000",
    "smartContractAddress": "0x...",
    "status": "created"
  },
  "pricing": {
    "setupFee": "$500 (one-time) - PAID TO ADMIN",
    "annualFee": "$200/year - PAID TO ADMIN",
    "tradingCommission": "0.5% on all trades - 100% TO ADMIN"
  }
}
```

**Revenue Impact (First Year):**
- Admin receives: **$500** setup fee (immediate)
- Admin receives: **$200/year** annual fee
- Admin receives: **0.5%** of all token trading volume

---

### `GET /api/v1/rwa/tokens` - List RWA Tokens
View all tokens created by the tenant with trading volume.

**Request:**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://api.example.com/api/v1/rwa/tokens
```

**Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "id": "token-ref-1",
      "assetName": "Real Estate Fund",
      "symbol": "REF",
      "blockchain": "ethereum",
      "totalSupply": "1000000",
      "status": "active",
      "setupFee": 500,
      "annualFee": 200,
      "tradingVolume": "250000 USD",
      "tradingCommission": "1250 USD (0.5% to admin)"
    }
  ],
  "summary": {
    "totalTokens": 1,
    "totalTradingCommissions": "1250 USD (100% to admin)",
    "setupFeesCollected": "500 USD (100% to admin)"
  }
}
```

---

### `POST /api/v1/rwa/tokens/:id/transfer` - Trade RWA Token
Token holder trades tokens. Admin collects 0.5% commission.

**Request:**
```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "toAddress": "0xabcd1234...",
    "amount": "100"
  }' \
  https://api.example.com/api/v1/rwa/tokens/token-ref-1/transfer
```

**Response:**
```json
{
  "success": true,
  "transfer": {
    "id": "transfer-123",
    "tokenId": "token-ref-1",
    "amount": "100 REF",
    "toAddress": "0xabcd1234...",
    "commission": "0.5 REF (0.5% to admin)",
    "status": "completed",
    "txHash": "0x..."
  },
  "note": "0.5% trading commission applied and collected by admin"
}
```

**Revenue Impact:**
- Admin receives: **0.5 REF** trading commission
- Scales infinitely with trading volume

---

## Admin Endpoints

### `GET /api/admin/revenue` - Crypto Revenue Dashboard
View all revenue from internal swaps and external withdrawals.

**Headers:**
```
x-admin-key: YOUR_ADMIN_KEY
```

**Request:**
```bash
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  https://api.example.com/api/admin/revenue
```

**Response:**
```json
{
  "success": true,
  "cryptoRevenue": {
    "totalSwapCommissions": "1245.67 USD",
    "totalGasMarkupRevenue": "3456.78 USD",
    "totalVolume": "249000 USD",
    "revenueByBlockchain": {
      "ethereum": "2345.67",
      "polygon": "1234.56",
      "bitcoin": "3456.78"
    },
    "topTransaction": {
      "type": "external_withdraw",
      "asset": "ETH",
      "gasProfit": "450.00"
    }
  }
}
```

**What's Tracked:**
- **Swap Commissions:** 0.5% from all internal swaps
- **Gas Markup Revenue:** 40% markup on all external withdrawals
- **By Blockchain:** Revenue breakdown by chain
- **Profit Margin:** All revenue is pure profit to admin

---

### `GET /api/admin/rwa-revenue` - RWA Revenue Dashboard
View all revenue from RWA tokens (setup fees + annual fees + trading commissions).

**Request:**
```bash
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  https://api.example.com/api/admin/rwa-revenue
```

**Response:**
```json
{
  "success": true,
  "rwaRevenue": {
    "setupFees": {
      "count": 12,
      "total": "6000 USD"
    },
    "annualFees": {
      "activeClients": 12,
      "total": "2400 USD"
    },
    "tradingCommissions": {
      "thisMonth": "12500 USD",
      "thisYear": "125000 USD",
      "rate": "0.5% of all trading volume"
    },
    "totalMonthlyRevenue": "15000 USD"
  }
}
```

**Revenue Breakdown:**
- **Setup Fees:** $500 per new token created
- **Annual Fees:** $200 per active token per year
- **Trading Commissions:** 0.5% of all token trading volume
- **Total:** 100% of all fees go to admin

---

### `PUT /api/admin/gas-settings/global` - Update Gas Markup
Change the global gas markup percentage (applies to all clients).

**Request:**
```bash
curl -X PUT -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "markup": 45 }' \
  https://api.example.com/api/admin/gas-settings/global
```

**Response:**
```json
{
  "success": true,
  "message": "Global gas markup updated to 45%",
  "newMarkup": 45
}
```

---

### `PUT /api/admin/gas-settings/client/:clientId` - Set Client-Specific Gas Markup
Override gas markup for a specific client.

**Request:**
```bash
curl -X PUT -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "markup": 50,
    "reason": "VIP client discount",
    "expiresAt": "2025-12-31T23:59:59Z"
  }' \
  https://api.example.com/api/admin/gas-settings/client/tenant-123
```

---

### `PATCH /api/admin/tenants/:id` - Update Tenant (Admin)
Update any tenant's tier or status.

**Request:**
```bash
curl -X PATCH -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "tier": "enterprise" }' \
  https://api.example.com/api/admin/tenants/tenant-123
```

---

### `POST /api/admin/tenants/:id/suspend` - Suspend Tenant
Suspend a tenant account (blocks all API access).

**Request:**
```bash
curl -X POST -H "x-admin-key: YOUR_ADMIN_KEY" \
  https://api.example.com/api/admin/tenants/tenant-123/suspend
```

---

---

## Real-World Usage Examples

### Example 1: Client Swaps BTC → ETH (Earn 0.5% Commission)

**Scenario:** Client has 1 BTC in virtual account, wants to swap to ETH.

**Step 1:** Get virtual account
```bash
curl -H "x-api-key: CLIENT_API_KEY" \
  https://api.example.com/api/v1/gateway/virtual-accounts
# Returns: va-123 with 1 BTC balance
```

**Step 2:** Perform swap (0.5% commission to admin)
```bash
curl -X POST -H "x-api-key: CLIENT_API_KEY" \
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
  https://api.example.com/api/v1/gateway/swap
```

**Result:**
- Client swaps: 1 BTC → 15.5 ETH
- Commission (0.5%): 0.0775 ETH ✅ **ADMIN PROFIT**
- Client receives: 15.4225 ETH

---

### Example 2: Client Withdraws ETH (Earn 40% Gas Markup)

**Scenario:** Client withdraws 1 ETH to external wallet.

**Step 1:** Create virtual account and add funds (simulated)

**Step 2:** Withdraw to external wallet (40% gas markup to admin)
```bash
curl -X POST -H "x-api-key: CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccountId": "va-123",
    "toExternalAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "assetName": "ETH",
    "blockchain": "ethereum",
    "amount": "1.0"
  }' \
  https://api.example.com/api/v1/gateway/withdraw
```

**Result:**
- Real gas fee: $3.00
- Client charged: $4.20 (40% markup)
- Admin profit: **$1.20** ✅ **ADMIN PROFIT**

---

### Example 3: Client Creates RWA Token (Earn $500 + 0.5% Trading)

**Scenario:** RE company creates real estate tokenization.

**Step 1:** Create token ($500 setup fee to admin)
```bash
curl -X POST -H "x-api-key: CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "assetName": "Downtown Office Building",
    "symbol": "DOFF",
    "blockchain": "ethereum",
    "decimals": 18,
    "totalSupply": "1000000",
    "issuerName": "Downtown RE Corp"
  }' \
  https://api.example.com/api/v1/rwa/tokens
```

**Result:**
- Token created
- Admin receives: **$500** ✅ **ADMIN PROFIT**
- Admin receives: **$200/year** annual fee ✅ **RECURRING PROFIT**

**Step 2:** Clients trade token (0.5% commission to admin)
- 1 month trading volume: $100K
- Admin commission: **$500** ✅ **ADMIN PROFIT**
- Annual trading commissions: **$6K** if volume remains constant

---

### Example 4: Admin Dashboard - Track All Revenue

```bash
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  https://api.example.com/api/admin/revenue
```

**Dashboard Shows:**
- Total swaps: 5,432 transactions
- Total swap commissions: **$1,245.67** ✅ **ALL TO ADMIN**
- Total gas markup: **$3,456.78** ✅ **ALL TO ADMIN**
- Monthly revenue: **$4,702.45**
- Projected annual revenue: **$56,429** + RWA revenue

---

## Integration Checklist

✅ **Public Endpoints** (no auth needed)
- GET / - API info
- GET /api/docs - Documentation
- GET /api/health - Health check
- GET /api/pricing - Pricing tiers
- GET /api/chains - Supported blockchains

✅ **Tenant Endpoints** (x-api-key header)
- POST /api/tenants - Create tenant
- GET /api/tenants/:id - Tenant details
- PATCH /api/tenants/:id - Update profile
- POST /api/tenants/:id/rotate-key - Rotate key

✅ **CRYPTO Panel** (x-api-key header)
- POST /api/v1/gateway/virtual-accounts - Create account
- GET /api/v1/gateway/virtual-accounts - List accounts
- POST /api/v1/gateway/swap - Internal swap (0.5% commission)
- POST /api/v1/gateway/withdraw - External withdraw (40% gas markup)
- GET /api/v1/transactions - View history

✅ **RWA Panel** (x-api-key header)
- POST /api/v1/rwa/tokens - Create token ($500 setup)
- GET /api/v1/rwa/tokens - List tokens
- POST /api/v1/rwa/tokens/:id/transfer - Trade tokens (0.5% commission)

✅ **Admin Endpoints** (x-admin-key header)
- GET /api/admin/revenue - Crypto revenue dashboard
- GET /api/admin/rwa-revenue - RWA revenue dashboard
- PUT /api/admin/gas-settings/global - Update gas markup
- PATCH /api/admin/tenants/:id - Update tenant tier

---

## Revenue Summary

**CRYPTO Panel (Monthly):**
- Internal swaps (0.5% commission): ~$25K
- External withdrawals (40% gas markup): ~$12K
- **Monthly Total:** ~$37K
- **Annual Total:** ~$444K

**RWA Panel (Monthly):**
- Setup fees: Variable ($500 per new token)
- Annual fees: Recurring ($200 per token)
- Trading commissions (0.5%): Scales with volume
- **Monthly Average:** ~$54.5K
- **Annual Total:** ~$654K (growing exponentially)

**Total Year 1:** ~$858K with 82.5% profit margin

---

**Last Updated:** November 30, 2024  
**Status:** Production Ready  
**Deployment:** Vercel + PostgreSQL (Neon)
