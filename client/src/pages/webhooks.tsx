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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Trash2, Copy, Check, Webhook as WebhookIcon } from "lucide-react";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered?: string;
  lastStatus?: number;
  retryCount: number;
  createdAt: string;
}

const WEBHOOK_EVENTS = [
  { id: "ADDRESS_TRANSACTION", label: "Address Transaction" },
  { id: "INCOMING_NATIVE_TX", label: "Incoming Native TX" },
  { id: "OUTGOING_NATIVE_TX", label: "Outgoing Native TX" },
  { id: "INCOMING_FUNGIBLE_TX", label: "Incoming Token TX" },
  { id: "OUTGOING_FUNGIBLE_TX", label: "Outgoing Token TX" },
  { id: "INCOMING_NFT_TX", label: "Incoming NFT TX" },
  { id: "OUTGOING_NFT_TX", label: "Outgoing NFT TX" },
  { id: "FAILED_TX", label: "Failed Transaction" },
];

export default function WebhooksPage() {
  const [apiKey, setApiKey] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    url: "",
    events: [] as string[],
  });

  const { data, isLoading, refetch } = useQuery<{ webhooks: Webhook[] }>({
    queryKey: ["/api/v1/webhooks"],
    enabled: !!apiKey,
    queryFn: async () => {
      const res = await fetch("/api/v1/webhooks", {
        headers: { "x-api-key": apiKey },
      });
      return res.json();
    },
  });

  const handleCreate = async () => {
    if (!formData.url || formData.events.length === 0) {
      toast({
        title: "Error",
        description: "URL and at least one event are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/v1/webhooks", {
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
          title: "Webhook Created",
          description: `HMAC Secret: ${result.webhook.hmacSecret}`,
        });
        refetch();
        setIsCreating(false);
        setFormData({ url: "", events: [] });
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

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/webhooks/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Webhook Deleted" });
        refetch();
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

  const toggleEvent = (eventId: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
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
          <h1 className="text-2xl font-semibold" data-testid="text-webhooks-title">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Subscribe to blockchain events in real-time
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-webhook" disabled={!apiKey}>
              <Plus className="h-4 w-4 mr-2" />
              New Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Subscribe to blockchain events and receive notifications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://your-app.com/webhook"
                  data-testid="input-webhook-url"
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={event.id}
                        checked={formData.events.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                      />
                      <Label htmlFor={event.id} className="text-xs cursor-pointer">
                        {event.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button 
                onClick={handleCreate} 
                className="w-full"
                data-testid="button-submit-webhook"
              >
                Create Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Key</CardTitle>
          <CardDescription>Enter your tenant API key to manage webhooks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="tatum_xxxxxxxx..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
              data-testid="input-api-key-webhooks"
            />
            <Button 
              onClick={() => refetch()} 
              disabled={!apiKey}
              data-testid="button-load-webhooks"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {apiKey && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WebhookIcon className="h-5 w-5" />
              Active Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.webhooks?.map((webhook) => (
                    <TableRow key={webhook.id} data-testid={`row-webhook-${webhook.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[200px]">
                          <span className="truncate font-mono text-sm">{webhook.url}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => copyToClipboard(webhook.url, webhook.id)}
                          >
                            {copiedId === webhook.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.slice(0, 2).map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event.replace(/_/g, " ")}
                            </Badge>
                          ))}
                          {webhook.events.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{webhook.events.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={webhook.active ? "default" : "secondary"}>
                          {webhook.active ? "Active" : "Inactive"}
                        </Badge>
                        {webhook.lastStatus && webhook.lastStatus >= 400 && (
                          <Badge variant="destructive" className="ml-1">
                            {webhook.lastStatus}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {webhook.lastTriggered 
                          ? new Date(webhook.lastTriggered).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(webhook.id)}
                          data-testid={`button-delete-${webhook.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.webhooks || data.webhooks.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No webhooks configured. Create your first one!
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
