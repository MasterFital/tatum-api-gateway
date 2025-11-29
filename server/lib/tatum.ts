import { SUPPORTED_CHAINS, PRICING } from "@shared/schema";

const TATUM_API_URL = process.env.TATUM_API_URL || "https://api.tatum.io";
const TATUM_API_KEY = process.env.TATUM_API_KEY;

if (!TATUM_API_KEY) {
  console.warn("TATUM_API_KEY not configured - API calls will fail");
}

interface TatumResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  retryAfter?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
  successesInHalfOpen: number;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  state: "closed",
  successesInHalfOpen: 0,
};

const CIRCUIT_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenSuccessThreshold: 2,
};

function checkCircuitBreaker(): boolean {
  if (circuitBreaker.state === "open") {
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
    if (timeSinceLastFailure >= CIRCUIT_CONFIG.resetTimeoutMs) {
      circuitBreaker.state = "half-open";
      circuitBreaker.successesInHalfOpen = 0;
      return true;
    }
    return false;
  }
  return true;
}

function recordSuccess(): void {
  if (circuitBreaker.state === "half-open") {
    circuitBreaker.successesInHalfOpen++;
    if (circuitBreaker.successesInHalfOpen >= CIRCUIT_CONFIG.halfOpenSuccessThreshold) {
      circuitBreaker.state = "closed";
      circuitBreaker.failures = 0;
    }
  } else {
    circuitBreaker.failures = 0;
  }
}

function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  if (circuitBreaker.state === "half-open") {
    circuitBreaker.state = "open";
  } else if (circuitBreaker.failures >= CIRCUIT_CONFIG.failureThreshold) {
    circuitBreaker.state = "open";
  }
}

function isRetryableError(statusCode: number, config: RetryConfig): boolean {
  return config.retryableStatuses.includes(statusCode);
}

function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
    config.maxDelayMs
  );
  return delay;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tatumRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<TatumResponse<T>> {
  if (!checkCircuitBreaker()) {
    return {
      success: false,
      error: "Service temporarily unavailable (circuit breaker open)",
      statusCode: 503,
    };
  }

  let lastError: TatumResponse<T> | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${TATUM_API_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": TATUM_API_KEY || "",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorResponse: TatumResponse<T> = {
          success: false,
          error: data?.message || data?.error || `HTTP ${response.status}`,
          statusCode: response.status,
        };

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          if (retryAfter) {
            errorResponse.retryAfter = parseInt(retryAfter, 10) * 1000;
          }
        }

        if (isRetryableError(response.status, retryConfig) && attempt < retryConfig.maxRetries) {
          lastError = errorResponse;
          const backoffMs = errorResponse.retryAfter || calculateBackoff(attempt, retryConfig);
          await sleep(backoffMs);
          continue;
        }

        recordFailure();
        return errorResponse;
      }

      recordSuccess();
      return { success: true, data };
    } catch (error: any) {
      const isTimeout = error.name === "AbortError";
      const isNetworkError = error.message?.includes("fetch") || error.message?.includes("network");

      const errorResponse: TatumResponse<T> = {
        success: false,
        error: isTimeout ? "Request timeout" : error.message || "Network error",
        statusCode: isTimeout ? 408 : 500,
      };

      if ((isTimeout || isNetworkError) && attempt < retryConfig.maxRetries) {
        lastError = errorResponse;
        await sleep(calculateBackoff(attempt, retryConfig));
        continue;
      }

      recordFailure();
      return errorResponse;
    }
  }

  return lastError || {
    success: false,
    error: "Max retries exceeded",
    statusCode: 500,
  };
}

const CHAIN_MAPPING: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
  polygon: "polygon",
  tron: "tron",
  bsc: "bsc",
  ripple: "xrp",
  cardano: "ada",
  near: "near",
  polkadot: "dot",
  avalanche: "avax",
  arbitrum: "arbitrum-one",
  optimism: "optimism",
  base: "base",
  fantom: "fantom",
  cronos: "cro",
  cosmos: "atom",
  algorand: "algo",
};

export const tatumClient = {
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...circuitBreaker };
  },

  resetCircuitBreaker(): void {
    circuitBreaker.failures = 0;
    circuitBreaker.lastFailure = 0;
    circuitBreaker.state = "closed";
    circuitBreaker.successesInHalfOpen = 0;
  },

  async generateAddress(chain: string): Promise<TatumResponse<{
    address: string;
    publicKey?: string;
    privateKey?: string;
  }>> {
    const chainId = CHAIN_MAPPING[chain] || chain;
    return tatumRequest(`/v3/${chainId}/wallet`, { method: "GET" });
  },

  async getBalance(chain: string, address: string): Promise<TatumResponse<{
    balance: string;
    tokens?: Array<{ symbol: string; balance: string; }>;
  }>> {
    const chainId = CHAIN_MAPPING[chain] || chain;
    
    if (["ethereum", "polygon", "bsc", "arbitrum-one", "optimism", "base"].includes(chainId)) {
      return tatumRequest(`/v3/${chainId}/account/balance/${address}`);
    } else if (chainId === "bitcoin") {
      return tatumRequest(`/v3/bitcoin/address/balance/${address}`);
    } else if (chainId === "solana") {
      return tatumRequest(`/v3/solana/account/balance/${address}`);
    }
    
    return tatumRequest(`/v3/${chainId}/account/balance/${address}`);
  },

  async getTokens(chain: string, address: string): Promise<TatumResponse<Array<{
    contractAddress: string;
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
  }>>> {
    const chainId = CHAIN_MAPPING[chain] || chain;
    return tatumRequest(`/v3/data/tokens?chain=${chainId}&addresses=${address}`);
  },

  async getNFTs(chain: string, address: string): Promise<TatumResponse<Array<{
    contractAddress: string;
    tokenId: string;
    metadata: any;
  }>>> {
    const chainId = CHAIN_MAPPING[chain] || chain;
    return tatumRequest(`/v3/data/nfts?chain=${chainId}&addresses=${address}`);
  },

  async getTransactionHistory(
    chain: string, 
    address: string,
    params?: { pageSize?: number; offset?: number }
  ): Promise<TatumResponse<Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    status: string;
  }>>> {
    const chainId = CHAIN_MAPPING[chain] || chain;
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.set("pageSize", params.pageSize.toString());
    if (params?.offset) queryParams.set("offset", params.offset.toString());
    
    return tatumRequest(`/v3/data/transactions?chain=${chainId}&addresses=${address}&${queryParams.toString()}`);
  },

  async getTransaction(chain: string, hash: string): Promise<TatumResponse<{
    hash: string;
    from: string;
    to: string;
    value: string;
    fee: string;
    blockNumber: number;
    confirmations: number;
    status: string;
  }>> {
    const chainId = CHAIN_MAPPING[chain] || chain;
    return tatumRequest(`/v3/${chainId}/transaction/${hash}`);
  },

  async estimateFee(chain: string, type: string = "TRANSFER"): Promise<TatumResponse<{
    fast: string;
    medium: string;
    slow: string;
  }>> {
    const chainId = CHAIN_MAPPING[chain] || chain;
    return tatumRequest(`/v3/${chainId}/gas/estimate`, {
      method: "POST",
      body: JSON.stringify({ type }),
    });
  },

  async broadcastTransaction(chain: string, txData: string): Promise<TatumResponse<{
    txId: string;
  }>> {
    const chainId = CHAIN_MAPPING[chain] || chain;
    return tatumRequest(`/v3/${chainId}/broadcast`, {
      method: "POST",
      body: JSON.stringify({ txData }),
    });
  },

  async getExchangeRates(symbols: string[]): Promise<TatumResponse<Record<string, {
    usd: number;
    eur: number;
    btc: number;
  }>>> {
    const symbolList = symbols.join(",");
    return tatumRequest(`/v3/tatum/rate/${symbolList}?basePair=USD`);
  },

  async resolveWeb3Name(name: string): Promise<TatumResponse<{
    address: string;
  }>> {
    return tatumRequest(`/v3/blockchain/names/${name}`);
  },

  async checkMaliciousAddress(address: string): Promise<TatumResponse<{
    isMalicious: boolean;
    riskScore: number;
    labels: string[];
  }>> {
    return tatumRequest(`/v3/security/address/${address}`);
  },

  async createWebhook(data: {
    type: string;
    attr: {
      address?: string;
      chain: string;
      url: string;
    };
  }): Promise<TatumResponse<{
    id: string;
  }>> {
    return tatumRequest(`/v4/subscription`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteWebhook(id: string): Promise<TatumResponse<void>> {
    return tatumRequest(`/v4/subscription/${id}`, {
      method: "DELETE",
    });
  },

  async getWebhooks(): Promise<TatumResponse<Array<{
    id: string;
    type: string;
    attr: any;
  }>>> {
    return tatumRequest(`/v4/subscription`);
  },

  async healthCheck(): Promise<TatumResponse<{
    status: string;
    version: string;
    circuitBreaker: CircuitBreakerState;
  }>> {
    const result = await tatumRequest(`/v3/tatum/version`);
    if (result.success) {
      return { 
        success: true, 
        data: { 
          status: "healthy", 
          version: result.data?.version || "v3",
          circuitBreaker: { ...circuitBreaker },
        } 
      };
    }
    return {
      ...result,
      data: {
        status: "degraded",
        version: "unknown",
        circuitBreaker: { ...circuitBreaker },
      },
    };
  },
};

export function getPricing(action: keyof typeof PRICING) {
  return PRICING[action] || { units: 1, cost: 0.001 };
}

export function getChainInfo(chainId: string) {
  return SUPPORTED_CHAINS.find(c => c.id === chainId);
}
