# 🔗 TATUM INTEGRATION GUIDE - STEP BY STEP
## How Every Endpoint Uses Tatum API

---

# 📌 OVERVIEW: WHAT IS TATUM?

```
TATUM = Blockchain abstraction layer
├─ Works with ALL blockchains (Bitcoin, Ethereum, Solana, Polygon, etc.)
├─ Handles wallet generation, key management, transactions
├─ You send 1 request, it handles blockchain complexity
└─ We just call HTTP endpoints

TATUM ENDPOINTS WE USE:
├─ Generate Wallet: POST /v3/{blockchain}/wallet
├─ Get Balance: GET /v3/{blockchain}/account/balance/{address}
├─ Estimate Gas: POST /v3/{blockchain}/transaction/estimate
├─ Send Transaction: POST /v3/{blockchain}/transaction/send
├─ Get Exchange Rate: GET /v3/rate/{currency}
└─ Get Blockchain Info: GET /v3/{blockchain}/info
```

---

# 🔑 STEP 1: GET TATUM API KEY

```
Already installed in your Replit secrets!

VERIFY IT WORKS:
curl -X GET "https://api.tatum.io/v3/bitcoin/info" \
  -H "x-api-key: YOUR_API_KEY"

RESPONSE:
{
  "chain": "Bitcoin",
  "blocks": 850123,
  "mempool": 5000,
  "version": "0.21.1"
}

If you get 401: "Invalid API key"
└─ Check your API key in Replit secrets
```

---

# 🪙 STEP 2: GENERATE MASTER WALLETS

## What: Create wallet for BTC, ETH, SOL, MATIC

```
THIS IS FOR:
├─ Crypto Panel: Your master wallets (you control)
├─ RWA Panel: Client master wallets (client controls)
└─ Generate once, store forever

TATUM ENDPOINT:
POST https://api.tatum.io/v3/{blockchain}/wallet
x-api-key: YOUR_API_KEY

REQUEST BODY:
```json
{
  // For Ethereum/Polygon (EVM chains)
  "mnemonic": "abandon ability able about above..." // optional, generate one for us
}

// For Bitcoin (different format)
// For Solana (different format)
```

RESPONSE (Bitcoin example):
```json
{
  "xpub": "xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB",
  "mnemonic": "abandon ability able about above..."
}
```

RESPONSE (Ethereum example):
```json
{
  "xpub": "xpub661MyMwAqRbcGKv7Rz...",
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "privateKey": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "mnemonic": "abandon ability able about above..."
}
```

WHAT WE STORE:
├─ address: public blockchain address
├─ privateKey: ENCRYPTED (not plaintext!)
├─ mnemonic: store securely as backup
└─ xpub: optional, for HD wallet derivation

IMPLEMENTATION:
```typescript
// server/lib/tatum.ts

export async function generateWallet(blockchain: string) {
  const response = await axios.post(
    `https://api.tatum.io/v3/${blockchain}/wallet`,
    { mnemonic: generateMnemonic() }, // or empty {}
    {
      headers: { 'x-api-key': process.env.TATUM_API_KEY }
    }
  );
  
  // Response varies by blockchain
  let address, privateKey;
  
  if (blockchain === 'bitcoin') {
    address = response.data.address;
    privateKey = response.data.privateKey;
  } else if (blockchain === 'ethereum' || blockchain === 'polygon') {
    address = response.data.address;
    privateKey = response.data.privateKey;
  } else if (blockchain === 'solana') {
    address = response.data.address;
    privateKey = response.data.privateKey;
  }
  
  return {
    address,
    privateKey, // MUST ENCRYPT BEFORE STORING
    xpub: response.data.xpub,
    mnemonic: response.data.mnemonic
  };
}
```

ERROR HANDLING:
```
400 Bad Request: Invalid blockchain
401 Unauthorized: Invalid API key
429 Too Many Requests: Rate limited (wait 1 second)
500 Server Error: Tatum is down (retry in 30 seconds)
```
```

---

# 💰 STEP 3: GET BALANCE

## What: Check wallet balance (cached from blockchain)

```
TATUM ENDPOINT:
GET https://api.tatum.io/v3/{blockchain}/account/balance/{address}
x-api-key: YOUR_API_KEY

EXAMPLE (Bitcoin):
GET /v3/bitcoin/account/balance/1A1z7agoat1Z3jiqoTCfUBpqmhRuZJnKY

RESPONSE:
```json
{
  "address": "1A1z7agoat1Z3jiqoTCfUBpqmhRuZJnKY",
  "balance": "0.99999999",        // in BTC
  "unconfirmed": "0.00000000",    // pending
  "nonce": null
}
```

EXAMPLE (Ethereum):
GET /v3/ethereum/account/balance/0x1234567890abcdef...

RESPONSE:
```json
{
  "address": "0x1234567890abcdef...",
  "balance": "1234567890123456789", // in WEI (not ETH!)
  "nonce": 42
}
```

IMPORTANT: Units differ by blockchain!
├─ Bitcoin: balance in BTC
├─ Ethereum: balance in WEI (1 ETH = 1e18 WEI)
├─ Solana: balance in LAMPORTS (1 SOL = 1e9 LAMPORTS)
└─ Always convert to human-readable format!

IMPLEMENTATION:
```typescript
export async function getBalance(blockchain: string, address: string) {
  const response = await axios.get(
    `https://api.tatum.io/v3/${blockchain}/account/balance/${address}`,
    {
      headers: { 'x-api-key': process.env.TATUM_API_KEY }
    }
  );
  
  // Convert to human readable
  let balance = response.data.balance;
  
  switch(blockchain) {
    case 'ethereum':
    case 'polygon':
      // Convert WEI to ETH/MATIC
      balance = (balance / 1e18).toString();
      break;
    case 'solana':
      // Convert LAMPORTS to SOL
      balance = (balance / 1e9).toString();
      break;
    // Bitcoin: already in BTC
  }
  
  return {
    address,
    balance,
    unconfirmed: response.data.unconfirmed || '0',
    nonce: response.data.nonce
  };
}
```

WHEN TO USE:
├─ On dashboard load: show current balance
├─ Before withdrawal: check sufficient balance
├─ For revenue tracking: sync balances monthly
└─ Cache this! Don't call every second (rate limits)
```

---

# 🚚 STEP 4: SEND TRANSACTION (External Withdraw)

## What: Send crypto to external wallet (real blockchain transaction)

```
THIS IS THE MONEY FLOW:
1. Client requests withdraw: 0.5 ETH
2. We validate they have it
3. We SIGN with master private key
4. We send via Tatum to blockchain
5. Tatum pays the gas fee
6. Blockchain processes it
7. We track the txHash

TATUM ENDPOINT:
POST https://api.tatum.io/v3/{blockchain}/transaction/send
x-api-key: YOUR_API_KEY

REQUEST (Ethereum example):
```json
{
  "to": "0xabcdef1234567890abcdef1234567890abcdef12",
  "amount": "0.5",
  "from": "0x1234567890abcdef1234567890abcdef12345678",
  "privateKey": "0xabcdef...",  // MUST BE ENCRYPTED IN TRANSIT!
  "nonce": 42,
  "gasPrice": "50",  // gwei
  "gasLimit": "21000"
}
```

RESPONSE:
```json
{
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "nonce": 43,
  "gasPrice": "50",
  "gasLimit": "21000",
  "gasUsed": "21000",
  "status": "pending"
}
```

CRITICAL: Private Key Security
├─ ONLY send via HTTPS (encrypted)
├─ NEVER log it
├─ NEVER return it to frontend
├─ Decrypt ONLY when calling Tatum
├─ Delete from memory immediately after
├─ Use AES-256 encryption in DB

IMPLEMENTATION:
```typescript
export async function sendTransaction(
  blockchain: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  privateKeyEncrypted: string,
  privateKeyIv: string
) {
  // 1. Decrypt private key (only for this call)
  const privateKey = decryptPrivateKey(privateKeyEncrypted, privateKeyIv);
  
  // 2. Get current nonce
  const balance = await getBalance(blockchain, fromAddress);
  
  // 3. Estimate gas
  const gasEstimate = await estimateGas(blockchain, toAddress, amount);
  
  // 4. Send transaction
  const response = await axios.post(
    `https://api.tatum.io/v3/${blockchain}/transaction/send`,
    {
      to: toAddress,
      amount: amount,
      from: fromAddress,
      privateKey: privateKey, // HTTPS encrypts it
      nonce: balance.nonce,
      gasPrice: gasEstimate.gasPrice,
      gasLimit: gasEstimate.gasLimit,
      // Blockchain-specific params
    },
    {
      headers: { 'x-api-key': process.env.TATUM_API_KEY }
    }
  );
  
  // 5. DELETE private key from memory
  privateKey = null;
  
  // 6. Return transaction info
  return {
    txHash: response.data.txHash,
    nonce: response.data.nonce,
    gasUsed: response.data.gasUsed,
    status: 'pending'
  };
}
```

WORKFLOW in your API:
```
POST /api/crypto/withdraw
├─ 1. Validate account balance
├─ 2. Calculate gas fee
├─ 3. Call sendTransaction()
│   └─ Decrypt private key
│   └─ Call Tatum
│   └─ Get txHash
│   └─ Delete private key
├─ 4. Update DB: balance -= amount
├─ 5. Create transaction record
└─ 6. Return txHash to client

Client can track with:
└─ https://etherscan.io/tx/{txHash}
```

ERRORS:
```
"Insufficient balance for this operation"
├─ Gas fee too high
├─ Add more funds
└─ Retry

"Invalid private key"
├─ Decryption failed
├─ Check ENCRYPTION_KEY in env
└─ Log alert

"Address format invalid"
├─ Validate address before sending
└─ Return to client to fix
```
```

---

# ⛽ STEP 5: ESTIMATE GAS FEE

## What: Calculate blockchain gas cost

```
WHY WE NEED THIS:
├─ Know how much blockchain costs
├─ Calculate YOUR 40% markup
├─ Charge client: gas + markup
└─ Your profit = markup

TATUM ENDPOINT:
POST https://api.tatum.io/v3/{blockchain}/transaction/estimate
x-api-key: YOUR_API_KEY

REQUEST (Ethereum example):
```json
{
  "to": "0xabcdef1234567890abcdef1234567890abcdef12",
  "amount": "0.5",
  "from": "0x1234567890abcdef1234567890abcdef12345678"
}
```

RESPONSE:
```json
{
  "gasPrice": "50",      // gwei
  "gasLimit": "21000",   // units
  "totalGas": "1050000", // total in gwei
  "totalGasInUSD": "3.50" // convert gas to USD
}
```

HOW WE USE IT:
```
1. Gas real (from Tatum): $3.50
2. Your markup: 40%
3. Markup amount: $3.50 × 0.4 = $1.40
4. Charged to client: $3.50 + $1.40 = $4.90
5. YOUR PROFIT: $1.40

So client pays $4.90
Tatum uses $3.50 for gas
You keep $1.40
```

IMPLEMENTATION:
```typescript
export async function estimateGas(
  blockchain: string,
  toAddress: string,
  amount: string
) {
  const response = await axios.post(
    `https://api.tatum.io/v3/${blockchain}/transaction/estimate`,
    {
      to: toAddress,
      amount: amount,
      from: YOUR_MASTER_WALLET_ADDRESS // for accurate estimate
    },
    {
      headers: { 'x-api-key': process.env.TATUM_API_KEY }
    }
  );
  
  return {
    gasPrice: response.data.gasPrice,
    gasLimit: response.data.gasLimit,
    totalGas: response.data.totalGas,
    totalGasInUSD: response.data.totalGasInUSD
  };
}
```

BLOCKCHAIN GAS DIFFERENCES:
```
Bitcoin: Cheap (~$1-5)
├─ UTXO model
├─ Simple transactions
└─ No smart contracts

Ethereum: Medium (~$2-50)
├─ Gas-based system
├─ Variable depending on network load
└─ ERC-20 transfers cost more than native

Polygon: Very Cheap (~$0.01-0.50)
├─ Layer 2 solution
├─ Same as Ethereum but cheaper
└─ Good for high-volume

Solana: Cheap (~$0.00025)
├─ Account-based
├─ Parallel processing
└─ Cheapest blockchain
```

OPTIMIZATION:
├─ Use batch transactions when possible
├─ Set optimal gas price (not too high, not too low)
├─ Monitor Tatum's gas recommendations
└─ Update multipliers per blockchain for accuracy
```

---

# 💱 STEP 6: GET EXCHANGE RATES

## What: Convert crypto to USD

```
WHY WE NEED THIS:
├─ Track revenue in USD
├─ Show client balance in USD
├─ Calculate USD commissions
├─ Dashboard reporting

TATUM ENDPOINT:
GET https://api.tatum.io/v3/rate/{currency}
x-api-key: YOUR_API_KEY

EXAMPLE:
GET /v3/rate/BTC?baseCurrency=USD

RESPONSE:
```json
{
  "value": "42500.50" // 1 BTC = $42,500.50 USD
}
```

CURRENCIES SUPPORTED:
├─ BTC, ETH, SOL, MATIC, etc.
├─ Any token on Tatum
└─ Updated every minute

IMPLEMENTATION:
```typescript
export async function getExchangeRate(asset: string): Promise<number> {
  try {
    const response = await axios.get(
      `https://api.tatum.io/v3/rate/${asset}?baseCurrency=USD`,
      {
        headers: { 'x-api-key': process.env.TATUM_API_KEY }
      }
    );
    
    return Number(response.data.value);
  } catch (error) {
    console.error(`Failed to get rate for ${asset}`, error);
    // Fallback to cached rate
    return getCachedRate(asset);
  }
}

// Usage:
const btcRate = await getExchangeRate('BTC'); // 42500.50
const amount = 1.5; // BTC
const usdValue = amount * btcRate; // 1.5 × 42500.50 = 63750.75
```

CACHING:
├─ Cache rates for 5 minutes
├─ Reduce API calls
├─ Faster dashboard
└─ Still accurate enough

IMPLEMENTATION WITH CACHE:
```typescript
const rateCache = new Map<string, { rate: number; expiry: number }>();

export async function getExchangeRateCached(asset: string): Promise<number> {
  const cached = rateCache.get(asset);
  
  // If cached and not expired, return it
  if (cached && Date.now() < cached.expiry) {
    return cached.rate;
  }
  
  // Otherwise fetch fresh
  const rate = await getExchangeRate(asset);
  
  // Cache for 5 minutes
  rateCache.set(asset, {
    rate,
    expiry: Date.now() + 5 * 60 * 1000
  });
  
  return rate;
}
```
```

---

# 🎯 STEP 7: PUT IT ALL TOGETHER

## Complete Flow: External Withdrawal

```
USER FLOW:
1. Client calls: POST /api/crypto/withdraw
   ├─ {amount: "0.5 ETH", toAddress: "0xABC..."}
   └─ Headers: {Authorization: Bearer API_KEY}

YOUR API LOGIC:
2. Validate account has balance
3. Get gas estimate from Tatum
   └─ POST /v3/ethereum/transaction/estimate
   └─ Response: totalGasInUSD: $3.50

4. Calculate YOUR profit
   ├─ Gas real: $3.50
   ├─ Markup 40%: $1.40
   ├─ Charged to client: $4.90
   └─ YOUR PROFIT: $1.40

5. Send transaction via Tatum
   └─ POST /v3/ethereum/transaction/send
   └─ Include encrypted private key
   └─ Response: txHash

6. Update database
   ├─ Account balance -= 0.5 ETH
   ├─ Create transaction record
   ├─ Log YOUR profit ($1.40)
   └─ Status: pending

7. Return to client
   ├─ {txHash: "0x123...", status: "pending"}
   └─ Client can track on Etherscan

BLOCKCHAIN PROCESSES TRANSACTION
├─ 15-30 seconds later: 1 confirmation
├─ Tatum receives gas fee
└─ Your profit locked in

YOUR REVENUE DASHBOARD SHOWS:
└─ Gas markup earned: +$1.40
```

---

# 📊 ERROR HANDLING & RATE LIMITS

## Tatum Error Responses

```
400 Bad Request
├─ Invalid address format
├─ Invalid amount
├─ Invalid blockchain
└─ FIX: Validate input before calling

401 Unauthorized
├─ Invalid API key
├─ API key expired
└─ FIX: Check TATUM_API_KEY in env

429 Too Many Requests
├─ Rate limit: 5 requests/second (free tier)
├─ Wait 1 second and retry
└─ FIX: Implement rate limit queuing

500 Internal Server Error
├─ Tatum infrastructure issue
├─ Bitcoin mempool issues
├─ Retry after 30 seconds
└─ Alert team

IMPLEMENTATION:
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limited: wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      } else if (error.response?.status === 500) {
        // Server error: wait longer and retry
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      // Other error: don't retry
      throw error;
    }
  }
}
```
```

---

# ✅ CHECKLIST: TATUM READY

```
[ ] API Key configured in environment
[ ] Test connection: curl -H "x-api-key" to Tatum
[ ] Encryption/decryption working
[ ] Generate wallet tested (Bitcoin, Ethereum, Solana)
[ ] Get balance working
[ ] Estimate gas working
[ ] Send transaction working (testnet)
[ ] Exchange rates working
[ ] Rate limiting implemented
[ ] Error handling implemented
[ ] Private key never logged or exposed
[ ] All Tatum responses properly parsed
[ ] USD conversion working
[ ] Profit calculation tested
```

---

**Now you understand Tatum integration end-to-end!**
Every API call, what it returns, and how to use it for your revenue model.
