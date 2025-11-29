import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Zap } from "lucide-react";

interface PricingTier {
  id: string;
  chains: string[];
  maxAddresses: number;
  maxWebhooks: number;
  maxVirtualAccounts: number;
  rateLimit: number;
  monthlyQuota: number;
  kmsAllowed: boolean;
  archivalAccess: boolean;
  pricing: {
    monthly: number | string;
    included: number | string;
  };
}

interface PricingAction {
  units: number;
  cost: number;
}

export default function PricingPage() {
  const { data, isLoading } = useQuery<{
    pricing: Record<string, PricingAction>;
    tiers: PricingTier[];
  }>({
    queryKey: ["/api/pricing"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-pricing-title">Pricing</h1>
          <p className="text-sm text-muted-foreground">
            Tier comparison and usage-based pricing
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[400px]" />
          ))
        ) : (
          data?.tiers?.map((tier) => (
            <Card 
              key={tier.id} 
              className={tier.id === "scale" ? "border-primary shadow-lg" : ""}
              data-testid={`card-tier-${tier.id}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl capitalize">{tier.id}</CardTitle>
                  {tier.id === "scale" && (
                    <Badge>Popular</Badge>
                  )}
                </div>
                <CardDescription>
                  {tier.id === "starter" && "For indie developers and small projects"}
                  {tier.id === "scale" && "For growing businesses and startups"}
                  {tier.id === "enterprise" && "For large organizations with custom needs"}
                </CardDescription>
                <div className="pt-2">
                  <span className="text-3xl font-bold">
                    {typeof tier.pricing.monthly === "number" 
                      ? `$${tier.pricing.monthly}` 
                      : tier.pricing.monthly}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {tier.chains.length} blockchain{tier.chains.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {tier.maxAddresses === -1 ? "Unlimited" : tier.maxAddresses} addresses
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {tier.maxWebhooks === -1 ? "Unlimited" : tier.maxWebhooks} webhook{tier.maxWebhooks !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tier.maxVirtualAccounts > 0 ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      {tier.maxVirtualAccounts === 0 
                        ? "No virtual accounts" 
                        : `${tier.maxVirtualAccounts} virtual accounts`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{tier.rateLimit} req/sec</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {tier.monthlyQuota === -1 
                        ? "Unlimited calls" 
                        : `${tier.monthlyQuota.toLocaleString()} calls/month`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tier.kmsAllowed ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">KMS integration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tier.archivalAccess ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Archival data access</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  variant={tier.id === "scale" ? "default" : "outline"}
                  data-testid={`button-select-${tier.id}`}
                >
                  {tier.id === "enterprise" ? "Contact Sales" : "Get Started"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Usage-Based Pricing
          </CardTitle>
          <CardDescription>
            Pay only for what you use beyond your included quota
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px]" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(data?.pricing || {}).map(([action, pricing]) => (
                <div 
                  key={action} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-muted-foreground">{pricing.units} units</p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    ${pricing.cost.toFixed(4)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supported Chains by Tier</CardTitle>
          <CardDescription>
            Blockchain access varies by subscription tier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.tiers?.map((tier) => (
              <div key={tier.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={tier.id === "enterprise" ? "default" : "outline"} className="capitalize">
                    {tier.id}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {tier.chains.length} chains
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tier.chains.map((chain) => (
                    <Badge key={chain} variant="secondary" className="text-xs font-mono">
                      {chain}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
