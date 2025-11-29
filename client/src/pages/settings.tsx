import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Shield, Key, Globe, Bell } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    enforceRateLimits: true,
    logAllRequests: true,
    enableWebhookRetry: true,
  });

  const { data: healthData } = useQuery<{
    status: string;
    services: Record<string, string>;
    timestamp: string;
  }>({
    queryKey: ["/api/health"],
    refetchInterval: 10000,
  });

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    toast({
      title: "Setting Updated",
      description: `${key} has been ${value ? "enabled" : "disabled"}`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-settings-title">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure API Gateway settings
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              System Status
            </CardTitle>
            <CardDescription>Current health of all services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">API Server</span>
              <Badge variant={healthData?.services?.api === "healthy" ? "default" : "destructive"}>
                {healthData?.services?.api || "checking..."}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm">Database</span>
              <Badge variant={healthData?.services?.database === "healthy" ? "default" : "destructive"}>
                {healthData?.services?.database || "checking..."}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm">Tatum API</span>
              <Badge variant={healthData?.services?.tatum === "healthy" ? "default" : "secondary"}>
                {healthData?.services?.tatum || "checking..."}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm">Last Check</span>
              <span className="text-xs text-muted-foreground font-mono">
                {healthData?.timestamp 
                  ? new Date(healthData.timestamp).toLocaleTimeString()
                  : "-"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Gateway Settings
            </CardTitle>
            <CardDescription>Configure API behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Block all API requests</p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(v) => handleSettingChange("maintenanceMode", v)}
                data-testid="switch-maintenance"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enforce Rate Limits</Label>
                <p className="text-xs text-muted-foreground">Apply tier-based throttling</p>
              </div>
              <Switch
                checked={settings.enforceRateLimits}
                onCheckedChange={(v) => handleSettingChange("enforceRateLimits", v)}
                data-testid="switch-rate-limits"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Log All Requests</Label>
                <p className="text-xs text-muted-foreground">Enable detailed request logging</p>
              </div>
              <Switch
                checked={settings.logAllRequests}
                onCheckedChange={(v) => handleSettingChange("logAllRequests", v)}
                data-testid="switch-logging"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Webhook Retry</Label>
                <p className="text-xs text-muted-foreground">Auto-retry failed webhooks</p>
              </div>
              <Switch
                checked={settings.enableWebhookRetry}
                onCheckedChange={(v) => handleSettingChange("enableWebhookRetry", v)}
                data-testid="switch-webhook-retry"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Configuration
          </CardTitle>
          <CardDescription>Environment and key settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tatum API URL</Label>
              <Input 
                value="https://api.tatum.io" 
                readOnly 
                className="font-mono bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>API Version</Label>
              <Input 
                value="v3 / v4" 
                readOnly 
                className="font-mono bg-muted"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tatum API Key Status</Label>
            <div className="flex items-center gap-2">
              <Badge variant="default">Configured</Badge>
              <span className="text-sm text-muted-foreground">
                Key is stored securely in environment variables
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Deployment
          </CardTitle>
          <CardDescription>Production configuration for Vercel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 font-mono text-sm space-y-2">
            <p><span className="text-muted-foreground">DATABASE_URL=</span>postgresql://...</p>
            <p><span className="text-muted-foreground">TATUM_API_KEY=</span>*****</p>
            <p><span className="text-muted-foreground">SESSION_SECRET=</span>*****</p>
            <p><span className="text-muted-foreground">NODE_ENV=</span>production</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="button-export-env">
              Export .env Template
            </Button>
            <Button variant="outline" data-testid="button-download-zip">
              Download as ZIP
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Documentation
          </CardTitle>
          <CardDescription>API reference and integration guides</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border hover-elevate cursor-pointer">
              <h3 className="font-medium">API Reference</h3>
              <p className="text-sm text-muted-foreground">
                Complete endpoint documentation
              </p>
            </div>
            <div className="p-4 rounded-lg border hover-elevate cursor-pointer">
              <h3 className="font-medium">Integration Guide</h3>
              <p className="text-sm text-muted-foreground">
                Step-by-step setup instructions
              </p>
            </div>
            <div className="p-4 rounded-lg border hover-elevate cursor-pointer">
              <h3 className="font-medium">Webhook Events</h3>
              <p className="text-sm text-muted-foreground">
                Event types and payload schemas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
