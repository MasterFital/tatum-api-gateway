import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Copy, Check, Wallet, Webhook, Database, Activity } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

interface TenantDetail {
  id: string;
  name: string;
  email: string;
  tier: string;
  status: string;
  companyName?: string;
  website?: string;
  billingEmail?: string;
  limits: {
    chains: string[];
    maxAddresses: number;
    maxWebhooks: number;
    maxVirtualAccounts: number;
    rateLimit: number;
    monthlyQuota: number;
  };
  usage: {
    addresses: number;
    webhooks: number;
    virtualAccounts: number;
    requests: number;
    units: number;
    costUsd: string;
    quota: {
      used: number;
      remaining: number;
      percentUsed: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export default function TenantDetailPage() {
  const [, params] = useRoute("/tenants/:id");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ tenant: TenantDetail }>({
    queryKey: ["/api/tenants", params?.id],
    enabled: !!params?.id,
  });

  const tenant = data?.tenant;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Tenant not found</p>
            <Button asChild className="mt-4">
              <Link href="/tenants">Back to Tenants</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/tenants">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" data-testid="text-tenant-name">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{tenant.email}</p>
        </div>
        <Badge variant={tenant.tier === "enterprise" ? "default" : "secondary"}>
          {tenant.tier}
        </Badge>
        <Badge variant={tenant.status === "active" ? "default" : "destructive"}>
          {tenant.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Addresses</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-address-count">
              {tenant.usage.addresses}
              <span className="text-sm font-normal text-muted-foreground">
                {tenant.limits.maxAddresses === -1 ? " / ∞" : ` / ${tenant.limits.maxAddresses}`}
              </span>
            </div>
            {tenant.limits.maxAddresses !== -1 && (
              <Progress 
                value={(tenant.usage.addresses / tenant.limits.maxAddresses) * 100} 
                className="mt-2 h-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-webhook-count">
              {tenant.usage.webhooks}
              <span className="text-sm font-normal text-muted-foreground">
                {tenant.limits.maxWebhooks === -1 ? " / ∞" : ` / ${tenant.limits.maxWebhooks}`}
              </span>
            </div>
            {tenant.limits.maxWebhooks !== -1 && (
              <Progress 
                value={(tenant.usage.webhooks / tenant.limits.maxWebhooks) * 100} 
                className="mt-2 h-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Virtual Accounts</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-va-count">
              {tenant.usage.virtualAccounts}
              <span className="text-sm font-normal text-muted-foreground">
                {tenant.limits.maxVirtualAccounts === -1 ? " / ∞" : ` / ${tenant.limits.maxVirtualAccounts}`}
              </span>
            </div>
            {tenant.limits.maxVirtualAccounts > 0 && (
              <Progress 
                value={(tenant.usage.virtualAccounts / tenant.limits.maxVirtualAccounts) * 100} 
                className="mt-2 h-2"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-usage-units">
              {tenant.usage.units.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground">
                {tenant.limits.monthlyQuota === -1 ? " / ∞" : ` / ${tenant.limits.monthlyQuota.toLocaleString()}`}
              </span>
            </div>
            {tenant.limits.monthlyQuota !== -1 && (
              <Progress 
                value={tenant.usage.quota.percentUsed} 
                className="mt-2 h-2"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Tenant information and identifiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tenant ID</span>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{tenant.id}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(tenant.id, "id")}
                  className="h-8 w-8"
                >
                  {copiedField === "id" ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="font-mono text-sm">{tenant.email}</span>
            </div>
            {tenant.companyName && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Company</span>
                  <span className="text-sm">{tenant.companyName}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rate Limit</span>
              <span className="font-mono text-sm">{tenant.limits.rateLimit} req/s</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">{new Date(tenant.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allowed Chains</CardTitle>
            <CardDescription>Blockchains this tenant can access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tenant.limits.chains.map((chain) => (
                <Badge key={chain} variant="outline" className="font-mono text-xs">
                  {chain}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing Summary</CardTitle>
          <CardDescription>Current month usage and costs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">API Requests</p>
              <p className="text-2xl font-bold">{tenant.usage.requests.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Units Consumed</p>
              <p className="text-2xl font-bold">{tenant.usage.units.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Estimated Cost</p>
              <p className="text-2xl font-bold text-green-600">${tenant.usage.costUsd}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
