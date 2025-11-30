import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";

function ApiInfo() {
  const apiInfo = {
    name: "Tatum API Gateway",
    version: "1.0.0",
    description: "Enterprise-grade blockchain API gateway supporting 130+ blockchains",
    status: "running",
    endpoints: {
      health: "GET /api/health",
      pricing: "GET /api/pricing",
      chains: "GET /api/chains",
      docs: "https://github.com/MasterFital/tatum-api-gateway#api-documentation"
    },
    docs: "https://api.tatum.io/docs",
    github: "https://github.com/MasterFital/tatum-api-gateway"
  };

  return (
    <pre 
      data-testid="api-info"
      style={{ 
        margin: 0, 
        padding: '20px',
        fontFamily: 'monospace',
        fontSize: '14px',
        backgroundColor: '#1a1a1a',
        color: '#00ff00',
        minHeight: '100vh'
      }}
    >
      {JSON.stringify(apiInfo, null, 2)}
    </pre>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ApiInfo} />
      <Route component={ApiInfo} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
