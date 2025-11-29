# Tatum API Gateway

**Enterprise-grade blockchain API gateway supporting 130+ blockchains with multi-tenant architecture, tier-based billing, and production Tatum integration.**

## Features

✅ **Multi-Blockchain Support**: 130+ blockchains via Tatum API  
✅ **Multi-Tenant Architecture**: Isolated tenants with API keys and authentication  
✅ **Tier-Based Billing**: Starter, Scale, Enterprise with different rate limits  
✅ **Rate Limiting**: Per-tier request limits with quota management  
✅ **Admin Panel**: Secure admin API with HMAC authentication  
✅ **Tatum Integration**: Circuit breaker, retry logic, health checks  
✅ **Security**: Hashed API keys, session management, DoS protection  
✅ **Production Ready**: Deployable to Vercel via GitHub  

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (or use Replit's built-in database)
- Tatum API key (get one at https://dashboard.tatum.io)

### Installation

```bash
# Clone the repository
git clone https://github.com/MasterFital/tatum-api-gateway.git
cd tatum-api-gateway

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Update .env with your Tatum API key and database URL
# IMPORTANT: Get a PRODUCTION Tatum API key from https://dashboard.tatum.io

# Run database migrations
npm run db:push

# Start the development server
npm run dev
```

The API will be available at `http://localhost:5000`

## Environment Configuration

### Development (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Tatum API (Production Key)
TATUM_API_KEY=your_production_tatum_api_key
TATUM_API_URL=https://api.tatum.io

# Authentication
SESSION_SECRET=your_session_secret_here
ADMIN_API_KEY=your_admin_api_key_here

# Server
NODE_ENV=development
PORT=5000
```

### Production (Vercel)

All environment variables are configured via Vercel dashboard or GitHub Actions secrets.

## API Endpoints

### Public Endpoints

```bash
# Health check
GET /api/health

# Pricing and tier information
GET /api/pricing

# Supported blockchains
GET /api/chains
```

### Tenant Management (Requires Auth)

```bash
# Create tenant
POST /api/tenants
Headers: { "X-API-Key": "your_api_key" }
Body: { 
  "name": "My App",
  "email": "contact@myapp.com",
  "tier": "starter"
}

# Get tenant info
GET /api/tenants/:tenantId
Headers: { "X-API-Key": "your_api_key" }

# Update tenant
PATCH /api/tenants/:tenantId
Headers: { "X-API-Key": "your_api_key" }

# Delete tenant
DELETE /api/tenants/:tenantId
Headers: { "X-API-Key": "your_api_key" }
```

### Blockchain Operations (Requires Auth)

```bash
# List addresses
GET /api/addresses?chain=ethereum&limit=10
Headers: { "X-API-Key": "your_api_key" }

# Create address
POST /api/addresses
Headers: { "X-API-Key": "your_api_key" }
Body: {
  "chain": "ethereum",
  "label": "My Wallet"
}

# Get address balance
GET /api/addresses/:chain/:address/balance
Headers: { "X-API-Key": "your_api_key" }

# Send transaction
POST /api/transactions/send
Headers: { "X-API-Key": "your_api_key" }
Body: {
  "chain": "ethereum",
  "to": "0x...",
  "amount": "1.5",
  "privateKey": "0x..."
}
```

### Admin Endpoints (Requires Admin Auth)

```bash
# Create admin API key
POST /api/admin/api-keys
Headers: { 
  "X-Admin-Key": "your_admin_key",
  "X-Request-ID": "unique_request_id",
  "X-Signature": "hmac_signature"
}

# List all tenants
GET /api/admin/tenants
Headers: { "X-Admin-Key": "your_admin_key" }

# Get metering data
GET /api/admin/metering/:tenantId
Headers: { "X-Admin-Key": "your_admin_key" }

# Reset rate limits
POST /api/admin/rate-limits/reset
Headers: { "X-Admin-Key": "your_admin_key" }
```

## Rate Limiting

Requests are rate-limited based on your tier:

| Tier | Monthly Requests | Requests/Hour | Price |
|------|-----------------|---------------|-------|
| Starter | 10,000 | 100 | Free |
| Scale | 100,000 | 1,000 | $99/mo |
| Enterprise | Unlimited | Unlimited | Custom |

## Deployment to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

## Development

### Build

```bash
npm run build
```

### Type checking

```bash
npm run check
```

### Production start

```bash
npm start
```

## Architecture

```
┌─────────────────────────────────────┐
│   Client Applications               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   API Gateway (Express)             │
│   - Authentication                  │
│   - Rate Limiting                   │
│   - Request Metering                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Tatum Client                      │
│   - Circuit Breaker                 │
│   - Retry Logic                     │
│   - Health Check                    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Tatum API (Production)            │
│   https://api.tatum.io              │
└─────────────────────────────────────┘
```

## Security

- **API Keys**: All API keys are hashed using SHA-256 before storage
- **Admin Auth**: HMAC-SHA256 signatures with timing-safe comparison
- **Rate Limiting**: Per-tier request limits with quota enforcement
- **DoS Protection**: Length checks on HMAC signatures before verification
- **Session Management**: Secure session storage with PostgreSQL or memory

## Monitoring

- Health check: `GET /api/health`
- Circuit breaker state: Tracks Tatum API failures
- Request logging: All API requests are logged with timestamps and response times
- Metering: Track usage per tenant with monthly quotas

## Troubleshooting

### Tatum API not responding

1. Check `TATUM_API_KEY` is correct in `.env`
2. Verify Tatum API status at https://status.tatum.io
3. Check circuit breaker state in logs
4. Ensure network can reach `api.tatum.io`

### Rate limiting issues

1. Check your current tier limits: `GET /api/pricing`
2. Check current usage: `GET /api/admin/metering/:tenantId`
3. Upgrade your tier for higher limits

### Database connection issues

1. Verify `DATABASE_URL` in `.env`
2. Run `npm run db:push` to sync schema
3. Check database is accessible

## Support

- GitHub Issues: https://github.com/MasterFital/tatum-api-gateway/issues
- Tatum Docs: https://docs.tatum.io
- Tatum Support: https://support.tatum.io

## License

MIT

---

**Get started**: [View Deployment Guide](./DEPLOYMENT.md)
