# Tatum API Gateway

## Overview
Enterprise-grade blockchain API gateway supporting 130+ blockchains with multi-tenant architecture, tier-based billing, real-time metering, complete Tatum API v3/v4 integration, and **AES-256-GCM encryption for master wallets**.

## Recent Changes
- **2025-11-30**: Security Hardening Complete ✅
  - Implemented AES-256-GCM encryption for master wallet private keys
  - Added KMS (Key Management System) with PBKDF2-SHA256 key derivation
  - Created private key decryption endpoint with full audit logging
  - Added privateKeyAuthTag column for GCM integrity verification
  - Fixed all TypeScript errors and type safety issues
  - **All changes committed to GitHub and ready for Vercel deployment**

- **2025-11-30**: Complete Documentation & Guide
  - Created TATUM_API_GATEWAY_GUIDE.md - Enterprise-grade guide aligned with Tatum API v3/v4
  - Created COMPLETE_API_ENDPOINTS.md - All endpoints with real-world examples
  - Documented full business model (CRYPTO panel + RWA panel revenue streams)
  - Added circuit breaker pattern and retry logic explanation
  - Included real-world usage examples and revenue calculations

- **2025-11-29**: Security Hardening
  - API keys now stored as hashes only (HMAC-SHA256) - never in plaintext
  - Added API key prefix for identification without exposing full key
  - Implemented key rotation endpoint with secure one-time return
  - Added admin authentication with separate admin API key
  - Protected tenant mutation endpoints with proper authorization
  - Demo seeding guarded behind SEED_DEMO_DATA environment variable
  - Tatum client resilience: retry logic with exponential backoff, circuit breaker

## Architecture

### Security Model
- **Master Wallet Private Keys**: AES-256-GCM encrypted with KMS-derived keys
- **Key Management System**: PBKDF2-SHA256 with 100,000 iterations for key derivation
- **API Keys**: Only SHA-256 hashes stored in database, never plaintext
- **Key Creation**: Full API key returned ONCE during tenant creation
- **Key Rotation**: Authenticated endpoint to rotate keys securely
- **Admin Access**: Separate admin API key for tier changes and account management
- **HMAC Signing**: Request signing for webhook verification
- **Audit Logging**: All private key access logged with full context

### Tech Stack
- **Frontend**: React + TypeScript + Shadcn UI + Tailwind CSS
- **Backend**: Express.js + TypeScript with AES-256-GCM encryption
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Blockchain**: Tatum API v3/v4 with circuit breaker pattern
- **Charts**: Recharts
- **Security**: KMS, PBKDF2, AES-256-GCM, HMAC-SHA256

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
│   │   ├── auth.ts         # Authentication middleware + API key generation
│   │   ├── encryption.ts   # AES-256-GCM encryption/decryption
│   │   ├── kms.ts          # Key Management System (PBKDF2-SHA256)
│   │   ├── metering.ts     # Usage tracking and billing
│   │   └── auth.ts         # Authentication middleware
│   ├── routes.ts           # Express API routes (all endpoints)
│   ├── storage.ts          # Database interface
│   ├── seed.ts             # Demo data seeding (dev only)
│   └── db.ts               # Drizzle connection
└── shared/
    └── schema.ts           # Database schemas & types with encryption fields
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
- `GET /api/v1/transactions` - Client's transaction history
- `POST /api/v1/rwa/tokens` - Create RWA token ($500 setup fee)
- `GET /api/v1/rwa/tokens` - List RWA tokens
- `POST /api/v1/rwa/tokens/:id/transfer` - Transfer RWA token (0.5% admin commission)

#### Admin Endpoints (x-admin-key header)
- `POST /api/admin/master-wallets` - Create master wallet with optional private key encryption
- `GET /api/admin/master-wallets` - List all master wallets
- `GET /api/admin/master-wallets/:id/private-key` - Decrypt private key (audit logged)
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
- `MASTER_KMS_SECRET` - Master secret for KMS (generate with `openssl rand -hex 32`)
- `ADMIN_API_KEY` - Admin authentication key (generate with `openssl rand -hex 32`)

Optional:
- `SEED_DEMO_DATA=true` - Enable demo data seeding (dev only)

### Commands
```bash
npm run dev          # Start development server
npm run db:push      # Push schema to database
npm run build        # Build for production
```

### Testing Private Key Encryption
```bash
# Create master wallet with private key (auto-encrypted)
curl -X POST http://localhost:5000/api/admin/master-wallets \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "blockchain": "ethereum",
    "assetName": "ETH",
    "assetType": "crypto",
    "address": "0x1234...",
    "publicKey": "0x5678...",
    "privateKey": "your_private_key_here"
  }'

# Decrypt private key (requires admin key, audit logged)
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  http://localhost:5000/api/admin/master-wallets/{id}/private-key
```

### Admin Operations
```bash
# Change tenant tier
curl -X PATCH http://localhost:5000/api/admin/tenants/{id} \
  -H "x-admin-key: your_admin_key" \
  -H "Content-Type: application/json" \
  -d '{"tier":"enterprise"}'

# Suspend tenant
curl -X POST http://localhost:5000/api/admin/tenants/{id}/suspend \
  -H "x-admin-key: your_admin_key"
```

## Deployment

### Vercel Configuration
- Configured in `vercel.json`
- Environment variables already set in Vercel dashboard
- Auto-deploys on `git push` to main branch

### Production Checklist
- ✅ GitHub repository synced
- ✅ All security features implemented
- ✅ Database schema updated with encryption fields
- ✅ Audit logging enabled
- ✅ TypeScript compilation clean
- ✅ Ready for Vercel deployment

## Documentation Status
- **TATUM_API_GATEWAY_GUIDE.md** ✅
  - Complete guide aligned with Tatum API v3/v4
  - Business model explanation (CRYPTO panel + RWA panel)
  - All endpoints documented with curl examples
  - Real-world usage scenarios and revenue calculations
  
- **COMPLETE_API_ENDPOINTS.md** ✅
  - Reference documentation for all endpoints
  - Request/response examples for every endpoint
  - Revenue tracking and admin dashboard guide
  - Real-world examples of CRYPTO panel and RWA panel usage

- **SECURITY_IMPLEMENTATION.md** ✅
  - AES-256-GCM encryption details
  - KMS architecture and key derivation
  - Private key storage and access patterns
  - Audit logging implementation

## User Preferences
- Enterprise B2B styling with IBM Plex fonts
- Information-dense dashboard UI
- Dark mode support
- Monospace for addresses/hashes
- Documentation aligned with Tatum official API docs
- Clear business model explanation in all guides
- Security-first approach to private key management
