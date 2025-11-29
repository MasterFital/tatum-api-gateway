import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Dashboard from "@/pages/dashboard";
import TenantsPage from "@/pages/tenants";
import TenantDetailPage from "@/pages/tenant-detail";
import AddressesPage from "@/pages/addresses";
import WebhooksPage from "@/pages/webhooks";
import UsagePage from "@/pages/usage";
import PricingPage from "@/pages/pricing";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/tenants" component={TenantsPage} />
      <Route path="/tenants/:id" component={TenantDetailPage} />
      <Route path="/addresses" component={AddressesPage} />
      <Route path="/webhooks" component={WebhooksPage} />
      <Route path="/usage" component={UsagePage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center justify-between gap-2 px-4 h-14 border-b bg-background sticky top-0 z-50">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <span className="font-mono text-sm text-muted-foreground">Tatum API Gateway</span>
                </div>
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
