import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { RefreshCw, TrendingUp, Activity, DollarSign, Zap } from "lucide-react";

interface UsageData {
  period: { start: string; end: string };
  totalRequests: number;
  totalUnits: number;
  totalCredits: number;
  costUsd: string;
  byEndpoint: Record<string, number>;
  byChain: Record<string, number>;
  quota: {
    used: number;
    remaining: number;
    percentUsed: number;
    limit: number;
  };
}

export default function UsagePage() {
  const [apiKey, setApiKey] = useState("");

  const { data, isLoading, refetch } = useQuery<{ usage: UsageData }>({
    queryKey: ["/api/v1/usage"],
    enabled: !!apiKey,
    queryFn: async () => {
      const res = await fetch("/api/v1/usage", {
        headers: { "x-api-key": apiKey },
      });
      return res.json();
    },
  });

  const usage = data?.usage;

  const endpointData = usage
    ? Object.entries(usage.byEndpoint)
        .map(([name, count]) => ({ name: name.replace("/api/v1/", ""), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    : [];

  const chainData = usage
    ? Object.entries(usage.byChain)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-usage-title">Usage Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Monitor API consumption and costs
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Key</CardTitle>
          <CardDescription>Enter your tenant API key to view usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="tatum_xxxxxxxx..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
              data-testid="input-api-key-usage"
            />
            <Button 
              onClick={() => refetch()} 
              disabled={!apiKey}
              data-testid="button-load-usage"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {apiKey && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="text-total-requests">
                    {(usage?.totalRequests || 0).toLocaleString()}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  This billing period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Units Consumed</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="text-total-units">
                    {Math.floor(usage?.totalUnits || 0).toLocaleString()}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Metered usage units
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold text-green-600" data-testid="text-cost">
                    ${usage?.costUsd || "0.0000"}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Based on pricing table
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quota Usage</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-quota-percent">
                      {usage?.quota.percentUsed || 0}%
                    </div>
                    <Progress 
                      value={usage?.quota.percentUsed || 0} 
                      className="mt-2 h-2"
                    />
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {usage?.quota.limit === -1 
                    ? "Unlimited" 
                    : `${(usage?.quota.remaining || 0).toLocaleString()} remaining`}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Endpoints</CardTitle>
                <CardDescription>Most used API endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[250px]" />
                ) : endpointData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={endpointData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No endpoint data yet
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chain Usage</CardTitle>
                <CardDescription>Requests by blockchain</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[250px]" />
                ) : chainData.length > 0 ? (
                  <div className="space-y-4">
                    {chainData.map((chain) => (
                      <div key={chain.name} className="flex items-center gap-4">
                        <Badge variant="outline" className="w-24 justify-center font-mono">
                          {chain.name}
                        </Badge>
                        <div className="flex-1">
                          <Progress 
                            value={(chain.count / (usage?.totalRequests || 1)) * 100} 
                            className="h-2"
                          />
                        </div>
                        <span className="text-sm font-mono w-16 text-right">
                          {chain.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No chain data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {usage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Billing Period</CardTitle>
                <CardDescription>Current usage period details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Period Start</p>
                    <p className="font-mono">{new Date(usage.period.start).toLocaleDateString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-mono">30 days</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Period End</p>
                    <p className="font-mono">{new Date(usage.period.end).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
