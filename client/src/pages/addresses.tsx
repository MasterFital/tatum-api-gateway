import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Plus, Search, Copy, Check, RefreshCw, Wallet } from "lucide-react";

interface Address {
  id: string;
  chain: string;
  currency: string;
  address: string;
  label?: string;
  tags?: string[];
  status: string;
  balance: string;
  balanceUsd: string;
  lastSynced?: string;
  createdAt: string;
}

const CHAINS = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "polygon", name: "Polygon", symbol: "MATIC" },
  { id: "tron", name: "Tron", symbol: "TRX" },
  { id: "bsc", name: "BNB Chain", symbol: "BNB" },
];

export default function AddressesPage() {
  const [search, setSearch] = useState("");
  const [selectedChain, setSelectedChain] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    chain: "ethereum",
    label: "",
  });

  const { data, isLoading, refetch } = useQuery<{ addresses: Address[]; pagination: any }>({
    queryKey: ["/api/v1/addresses"],
    enabled: !!apiKey,
    queryFn: async () => {
      const res = await fetch("/api/v1/addresses", {
        headers: { "x-api-key": apiKey },
      });
      return res.json();
    },
  });

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/v1/addresses", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Address Created",
          description: `New ${formData.chain} address generated`,
        });
        refetch();
        setIsCreating(false);
        setFormData({ chain: "ethereum", label: "" });
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

  const filteredAddresses = data?.addresses?.filter((addr) => {
    const matchesSearch = 
      addr.address.toLowerCase().includes(search.toLowerCase()) ||
      addr.label?.toLowerCase().includes(search.toLowerCase());
    const matchesChain = selectedChain === "all" || addr.chain === selectedChain;
    return matchesSearch && matchesChain;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-addresses-title">Addresses</h1>
          <p className="text-sm text-muted-foreground">
            Manage blockchain addresses for your tenants
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-address" disabled={!apiKey}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate New Address</DialogTitle>
              <DialogDescription>
                Create a new blockchain address on your selected chain
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="chain">Blockchain</Label>
                <Select
                  value={formData.chain}
                  onValueChange={(value) => setFormData({ ...formData, chain: value })}
                >
                  <SelectTrigger data-testid="select-address-chain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAINS.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id}>
                        {chain.name} ({chain.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label (optional)</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., Hot Wallet, Cold Storage"
                  data-testid="input-address-label"
                />
              </div>
              <Button 
                onClick={handleCreate} 
                className="w-full"
                data-testid="button-submit-address"
              >
                Generate Address
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Key</CardTitle>
          <CardDescription>Enter your tenant API key to manage addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="tatum_xxxxxxxx..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
              data-testid="input-api-key"
            />
            <Button 
              onClick={() => refetch()} 
              disabled={!apiKey}
              data-testid="button-load-addresses"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {apiKey && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search addresses..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-addresses"
                />
              </div>
              <Select value={selectedChain} onValueChange={setSelectedChain}>
                <SelectTrigger className="w-40" data-testid="select-filter-chain">
                  <SelectValue placeholder="All chains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All chains</SelectItem>
                  {CHAINS.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    <TableHead>Chain</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAddresses?.map((addr) => (
                    <TableRow key={addr.id} data-testid={`row-address-${addr.id}`}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {addr.chain.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{addr.address}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(addr.address, addr.id)}
                          >
                            {copiedId === addr.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{addr.label || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-mono">{addr.balance} {addr.currency}</p>
                          <p className="text-xs text-muted-foreground">${addr.balanceUsd}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={addr.status === "active" ? "default" : "secondary"}>
                          {addr.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Wallet className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredAddresses || filteredAddresses.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {search || selectedChain !== "all" 
                          ? "No addresses match your filters" 
                          : "No addresses yet. Generate your first one!"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
