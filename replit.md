# Tatum API Gateway

## Overview
Enterprise-grade blockchain API gateway supporting 130+ blockchains with multi-tenant architecture, tier-based billing, real-time metering, and complete Tatum API v3/v4 integration.

## Recent Changes
- **2025-11-30**: Complete Documentation & Guide
  - Created TATUM_API_GATEWAY_GUIDE.md - Enterprise-grade guide aligned with Tatum API v3/v4
  - Created COMPLETE_API_ENDPOINTS.md - All endpoints with real-world examples
  - Documented full business model (CRYPTO panel + RWA panel revenue streams)
  - Added circuit breaker pattern and retry logic explanation
  - Included real-world usage examples and revenue calculations
  - Step-by-step endpoint usage with curl examples
  - Admin dashboard guide and configuration instructions

- **2025-11-29**: Security Hardening
  - API keys now stored as hashes only (HMAC-SHA256) - never in plaintext
  - Added API key prefix for identification without exposing full key
  - Implemented key rotation endpoint with secure one-time return
  - Added admin authentication with separate admin API key
  - Protected tenant mutation endpoints with proper authorization
  - Demo seeding guarded behind SEED_DEMO_DATA environment variable
  - Tatum client resilience: retry logic with exponential backoff, circuit breaker

- **2025-11-29**: Initial implementation
  - Complete database schema for multi-tenancy
  - Tatum API client with all major endpoints
  - JWT + API Key authentication with HMAC signing
  - Tier-based rate limiting (Starter/Scale/Enterprise)
  - Real-time usage metering and billing aggregation
  - React dashboard with Recharts analytics
  - Full CRUD for tenants, addresses, webhooks

## Architecture

### Security Model
- **API Keys**: Only SHA-256 hashes stored in database, never plaintext
- **Key Creation**: Full API key returned ONCE during tenant creation
- **Key Rotation**: Authenticated endpoint to rotate keys securely
- **Admin Access**: Separate admin API key for tier changes and account management
- **HMAC Signing**: Request signing for webhook verification

### Tech Stack
- **Frontend**: React + TypeScript + Shadcn UI + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Blockchain**: Tatum API v3/v4
- **Charts**: Recharts
- **Fonts**: IBM Plex Sans/Mono (Carbon Design inspiration)

### Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/     # Shadcn UI + custom components
│   │   ├── pages/          # Route pages (dashboard, tenants, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and API client
├── server/
│   ├── lib/
│   │   ├── tatum.ts        # Tatum API client with retry/circuit breaker
│   │   ├── auth.ts         # Authentication middleware
│   │   └── metering.ts     # Usage tracking
│   ├── routes.ts           # Express API routes
│   ├── storage.ts          # Database interface
│   ├── seed.ts             # Demo data seeding (dev only)
│   └── db.ts               # Drizzle connection
└── shared/
    └── schema.ts           # Database schemas & types
```

### API Endpoints

#### Public Endpoints
- `GET /api/health` - System health check with circuit breaker status
- `GET /api/pricing` - Tier pricing info
- `GET /api/chains` - Supported blockchains (130+)
- `POST /api/tenants` - Create tenant (returns API key ONCE)

#### Tenant Authenticated Endpoints (x-api-key header)
- `GET /api/tenants/:id` - Tenant details with usage stats
- `PATCH /api/tenants/:id` - Update own profile (name, company, website, billingEmail)
- `POST /api/tenants/:id/rotate-key` - Rotate API key
- `POST /api/v1/addresses` - Generate blockchain address
- `GET /api/v1/addresses` - List addresses
- `GET /api/v1/addresses/:id/balance` - Get balance
- `GET /api/v1/addresses/:id/tokens` - Get ERC-20 tokens
- `GET /api/v1/addresses/:id/nfts` - Get NFTs
- `POST /api/v1/webhooks` - Create webhook
- `GET /api/v1/usage` - Usage analytics
- `GET /api/v1/audit-logs` - Audit trail

#### Admin Endpoints (x-admin-key header)
- `PATCH /api/admin/tenants/:id` - Update any tenant (tier changes)
- `POST /api/admin/tenants/:id/suspend` - Suspend tenant
- `POST /api/admin/tenants/:id/activate` - Reactivate tenant

### Tier Limits
| Feature | Starter | Scale | Enterprise |
|---------|---------|-------|------------|
| Chains | 3 | 8 | 130+ |
| Addresses | 50 | 1,000 | Unlimited |
| Webhooks | 1 | 10 | Unlimited |
| Rate Limit | 10/s | 100/s | Custom |
| Monthly Quota | 10K | 100K | Unlimited |
| KMS | No | Yes | Yes |

## Development

### Environment Variables
Required:
- `DATABASE_URL` - PostgreSQL connection string
- `TATUM_API_KEY` - Tatum API key
- `SESSION_SECRET` - Session encryption key
- `ADMIN_API_KEY` - Admin authentication key (generate with `openssl rand -hex 32`)

Optional:
- `SEED_DEMO_DATA=true` - Enable demo data seeding (dev only)

### Commands
```bash
npm run dev          # Start development server
npm run db:push      # Push schema to database
npm run build        # Build for production
```

### Testing Tenant API
```bash
# Create tenant (save the API key - it's only shown once!)
curl -X POST http://localhost:5000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","tier":"starter"}'

# Use returned API key for authenticated requests
curl http://localhost:5000/api/v1/addresses \
  -H "x-api-key: tatum_xxxxx..."

# Rotate API key
curl -X POST http://localhost:5000/api/tenants/{id}/rotate-key \
  -H "x-api-key: tatum_xxxxx..."
```

### Admin Operations
```bash
# Change tenant tier (requires ADMIN_API_KEY set)
curl -X PATCH http://localhost:5000/api/admin/tenants/{id} \
  -H "x-admin-key: your_admin_key" \
  -H "Content-Type: application/json" \
  -d '{"tier":"enterprise"}'

# Suspend tenant
curl -X POST http://localhost:5000/api/admin/tenants/{id}/suspend \
  -H "x-admin-key: your_admin_key"
```

## Deployment
Configured for Vercel deployment via `vercel.json`. Set environment variables in Vercel dashboard.

## Documentation Status
- **TATUM_API_GATEWAY_GUIDE.md** ✅
  - Complete guide aligned with Tatum API v3/v4 (https://docs.tatum.io)
  - Business model explanation (CRYPTO panel + RWA panel)
  - All 30+ endpoints documented with curl examples
  - Real-world usage scenarios and revenue calculations
  - Error handling, resilience patterns, and deployment guide
  
- **COMPLETE_API_ENDPOINTS.md** ✅
  - Reference documentation for all endpoints
  - Request/response examples for every endpoint
  - Revenue tracking and admin dashboard guide
  - Real-world examples of CRYPTO panel and RWA panel usage

## User Preferences
- Enterprise B2B styling with IBM Plex fonts
- Information-dense dashboard UI
- Dark mode support
- Monospace for addresses/hashes
- Documentation aligned with Tatum official API docs
- Clear business model explanation in all guides
