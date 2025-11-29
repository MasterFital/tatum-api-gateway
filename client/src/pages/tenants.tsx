import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, ExternalLink, Copy, Check } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  email: string;
  tier: string;
  status: string;
  companyName?: string;
  addressCount: number;
  usage: {
    requests: number;
    units: number;
    costUsd: string;
  };
  createdAt: string;
}

const TIER_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  starter: "outline",
  scale: "secondary",
  enterprise: "default",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  suspended: "destructive",
  deleted: "secondary",
};

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/tenants"],
  });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    tier: "starter",
    companyName: "",
  });

  const filteredTenants = data?.tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      t.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    try {
      const response = await apiRequest("POST", "/api/tenants", formData);
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Tenant Created",
          description: `API Key: ${result.tenant.apiKey}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
        setIsCreating(false);
        setFormData({ name: "", email: "", tier: "starter", companyName: "" });
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-tenants-title">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Manage multi-tenant API access
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-tenant">
              <Plus className="h-4 w-4 mr-2" />
              New Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Create a new API tenant with their own credentials and limits
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  data-testid="input-tenant-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@company.com"
                  data-testid="input-tenant-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Tier</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(value) => setFormData({ ...formData, tier: value })}
                >
                  <SelectTrigger data-testid="select-tenant-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="scale">Scale</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company (optional)</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Acme Inc"
                  data-testid="input-tenant-company"
                />
              </div>
              <Button 
                onClick={handleCreate} 
                className="w-full"
                data-testid="button-submit-tenant"
              >
                Create Tenant
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-tenants"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Addresses</TableHead>
                  <TableHead className="text-right">Usage (Units)</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants?.map((tenant) => (
                  <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        {tenant.companyName && (
                          <p className="text-xs text-muted-foreground">{tenant.companyName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{tenant.email}</TableCell>
                    <TableCell>
                      <Badge variant={TIER_BADGE_VARIANT[tenant.tier] || "outline"}>
                        {tenant.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[tenant.status] || "secondary"}>
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{tenant.addressCount}</TableCell>
                    <TableCell className="text-right font-mono">{tenant.usage.units.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">${tenant.usage.costUsd}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(tenant.id, tenant.id)}
                          data-testid={`button-copy-${tenant.id}`}
                        >
                          {copiedId === tenant.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/tenants/${tenant.id}`} data-testid={`link-tenant-${tenant.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredTenants || filteredTenants.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search ? "No tenants match your search" : "No tenants yet. Create your first one!"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
