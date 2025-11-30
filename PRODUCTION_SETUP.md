# 🚀 PRODUCTION SETUP - Tatum Integration Guide

## Current Status
✅ API Gateway architecture: COMPLETE  
✅ Tatum client implementation: COMPLETE  
✅ Circuit breaker & retry logic: COMPLETE  
✅ Business model endpoints: COMPLETE  
❌ **Tatum Production Testing: NOT YET DONE**

---

## What's Needed for Tatum Production

### 1. Get Tatum API Key (Production)
```
1. Go to https://dashboard.tatum.io
2. Sign up or log in
3. Create new API key (select "Production" network)
4. Copy your API key (looks like: a1b2c3d4e5f6g7h8i9j0...)
```

### 2. Configure Environment Variable
```bash
# In your deployment (Vercel, Docker, etc):
TATUM_API_KEY=your_production_api_key_here
TATUM_API_URL=https://api.tatum.io  # Production URL
```

### 3. Test Connection Before Going Live
```bash
# Use the test endpoint to verify:
curl -H "x-api-key: YOUR_API_KEY" https://your-api.com/api/test-tatum

# Should return:
{
  "success": true,
  "test": "Tatum API Connection Test",
  "status": {
    "message": "✅ Connected to Tatum API successfully",
    "blockchainInfo": {
      "chain": "Bitcoin",
      "blocks": 123456,
      "mempool": 5000
    }
  }
}
```

### 4. Verify All Endpoints Work
Test these critical endpoints:

**Generate Address**
```bash
POST /api/v1/addresses
{
  "chain": "ethereum",
  "accountType": "individual"
}
```

**Get Balance**
```bash
GET /api/v1/addresses
```

**Create Virtual Account**
```bash
POST /api/v1/gateway/virtual-accounts
{
  "accountType": "individual"
}
```

**Internal Swap (0.5% commission)**
```bash
POST /api/v1/gateway/swap
{
  "fromAccountId": "va-xxx",
  "fromAsset": "BTC",
  "toAsset": "ETH",
  "amount": "0.1"
}
```

---

## What's Currently Using Tatum API

### ✅ Already Implemented
1. **healthCheck()** - Tests API connection
   - Endpoint: `GET /v3/bitcoin/info`
   - Status: Ready for production

2. **generateAddress()** - Creates wallet addresses
   - Endpoint: `GET /v3/{chain}/wallet`
   - Status: Ready but needs testing

3. **getBalance()** - Fetches account balance
   - Endpoint: `GET /v3/{chain}/account/balance/{address}`
   - Status: Ready but needs testing

4. **getTransactionHistory()** - Transaction logs
   - Endpoint: `GET /v3/data/transactions`
   - Status: Ready but needs testing

5. **broadcastTransaction()** - Send transactions
   - Endpoint: `POST /v3/{chain}/broadcast`
   - Status: Ready but needs testing

6. **estimateFee()** - Gas estimation
   - Endpoint: `POST /v3/{chain}/gas/estimate`
   - Status: Ready but needs testing

---

## What's Using Mock Data (For Development)

### ⚠️ Currently Mocked
1. **Virtual Accounts** - Mock balances stored in memory
2. **RWA Tokens** - Mock token creation/transfers
3. **Admin Revenue** - Mock calculations

**Why**: These need business logic before Tatum integration

---

## Production Deployment Checklist

### Phase 1: Setup & Configuration
- [ ] Get Tatum production API key
- [ ] Set `TATUM_API_KEY` environment variable
- [ ] Set `TATUM_API_URL=https://api.tatum.io`
- [ ] Set `DATABASE_URL` to production PostgreSQL

### Phase 2: Testing
- [ ] Run `GET /api/test-tatum` - verify connection
- [ ] Test `POST /api/v1/addresses` - create addresses
- [ ] Test `GET /api/v1/addresses` - get balances
- [ ] Test `POST /api/v1/gateway/swap` - internal swaps
- [ ] Test `POST /api/v1/gateway/withdraw` - external withdrawals

### Phase 3: Business Logic Integration
- [ ] Connect virtual accounts to real master wallets
- [ ] Replace mock RWA token logic with DB persistence
- [ ] Connect revenue tracking to real transactions
- [ ] Enable webhook support from Tatum

### Phase 4: Security & Monitoring
- [ ] Enable HTTPS only
- [ ] Setup rate limiting per tier
- [ ] Configure alerting for failed transactions
- [ ] Monitor Tatum API usage and costs
- [ ] Setup logging and audit trail

### Phase 5: Go Live
- [ ] Load test with 100 concurrent users
- [ ] Verify circuit breaker works
- [ ] Verify retry logic handles failures
- [ ] Test error scenarios
- [ ] Deploy to Vercel/production

---

## Tatum API Costs (Production)

**Free Tier** (Perfect for Testing)
- 5 requests/second
- Unlimited monthly calls
- All blockchains
- No credit card needed
- Perfect for prototype

**Starter** ($50/month)
- 10 requests/second
- Unlimited monthly calls
- Priority support

**Scale** ($500/month)
- 100 requests/second
- Unlimited monthly calls
- Dedicated support

---

## Key Endpoints Implemented

| Endpoint | Status | Tatum Version | Notes |
|----------|--------|---------------|-------|
| `POST /api/v1/addresses` | Ready | v3 | Generate wallet addresses |
| `GET /api/v1/addresses` | Ready | v3 | Get address details & balance |
| `GET /api/v1/transactions` | Ready | v3 | Transaction history |
| `POST /api/v1/gateway/swap` | Ready | v3 | Internal swap (0.5% fee) |
| `POST /api/v1/gateway/withdraw` | Ready | v3 | External withdraw (40% gas) |
| `GET /api/admin/revenue` | Ready | Custom | Revenue dashboard |
| `GET /api/test-tatum` | Ready | v3 | Connection test |

---

## Next Steps After Deployment

1. **Monitor API Usage**
   - Track Tatum API call count
   - Monitor response times
   - Alert on failures

2. **Optimize Costs**
   - Cache balances to reduce calls
   - Batch requests where possible
   - Monitor overages

3. **Scale Features**
   - Add webhook support
   - Implement transaction streaming
   - Add advanced analytics

4. **Compliance**
   - KYC integration
   - AML checks
   - Audit logging

---

## Troubleshooting

### Connection Failed
```
Error: "Unable to connect to Tatum API"
Solution: 
1. Verify TATUM_API_KEY is set
2. Check network connectivity
3. Try /api/test-tatum endpoint
4. Check Tatum status: https://status.tatum.io
```

### Rate Limit Hit
```
Error: HTTP 429 (Too Many Requests)
Solution: 
1. API automatically retries with exponential backoff
2. Circuit breaker opens after 5 failures
3. Check your tier limit at https://dashboard.tatum.io
```

### Invalid API Key
```
Error: "Unauthorized" (401)
Solution:
1. Generate new key at https://dashboard.tatum.io
2. Ensure it's the PRODUCTION key, not testnet
3. Verify no extra spaces in env variable
```

---

## Support
- **Tatum Docs**: https://docs.tatum.io
- **API Reference**: https://docs.tatum.io/reference/welcome-to-the-tatum-api-reference
- **Status Page**: https://status.tatum.io
- **Support**: https://support.tatum.io

