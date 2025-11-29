import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Wallet, 
  Activity, 
  DollarSign,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalRequests: number;
  totalRevenue: string;
  totalAddresses: number;
  tierBreakdown: Record<string, number>;
  chainUsage: Record<string, number>;
}

interface HealthStatus {
  status: string;
  services: {
    api: string;
    database: string;
    tatum: string;
  };
}

const TIER_COLORS = {
  starter: "hsl(var(--chart-1))",
  scale: "hsl(var(--chart-2))",
  enterprise: "hsl(var(--chart-3))",
};

export default function Dashboard() {
  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: DashboardStats }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: healthData } = useQuery<HealthStatus>({
    queryKey: ["/api/health"],
    refetchInterval: 30000,
  });

  const stats = statsData?.stats;

  const tierData = stats ? Object.entries(stats.tierBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  })) : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Enterprise Blockchain API Gateway Overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {healthData?.services && (
            <>
              <Badge variant={healthData.services.api === "healthy" ? "default" : "destructive"}>
                API {healthData.services.api}
              </Badge>
              <Badge variant={healthData.services.tatum === "healthy" ? "default" : "secondary"}>
                Tatum {healthData.services.tatum}
              </Badge>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-tenants">
                {stats?.totalTenants || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {stats?.activeTenants || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Addresses</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-addresses">
                {stats?.totalAddresses || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Across all chains
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-requests">
                {(stats?.totalRequests || 0).toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-revenue">
                ${stats?.totalRevenue || "0.00"}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              From metered usage
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tier Distribution</CardTitle>
            <CardDescription>Breakdown of tenants by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Skeleton className="h-[180px] w-[180px] rounded-full" />
              </div>
            ) : tierData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {tierData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={TIER_COLORS[entry.name.toLowerCase() as keyof typeof TIER_COLORS]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No tenant data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Stats</CardTitle>
            <CardDescription>Platform metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Supported Chains</p>
                  <p className="text-xs text-muted-foreground">Including EVM, Bitcoin, Solana</p>
                </div>
              </div>
              <span className="text-xl font-bold">130+</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-green-500/10">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">API Uptime</p>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
              </div>
              <span className="text-xl font-bold">99.9%</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-500/10">
                  <Activity className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Avg Response Time</p>
                  <p className="text-xs text-muted-foreground">P95 latency</p>
                </div>
              </div>
              <span className="text-xl font-bold">48ms</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supported Blockchains</CardTitle>
          <CardDescription>Access 130+ blockchain networks through our unified API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["Bitcoin", "Ethereum", "Solana", "Polygon", "Tron", "BNB Chain", "XRP Ledger", "Cardano", "NEAR", "Polkadot", "Avalanche", "Arbitrum", "Optimism", "Base", "Fantom", "Cronos"].map((chain) => (
              <Badge key={chain} variant="outline" className="font-mono text-xs">
                {chain}
              </Badge>
            ))}
            <Badge variant="secondary" className="font-mono text-xs">
              +114 more
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
