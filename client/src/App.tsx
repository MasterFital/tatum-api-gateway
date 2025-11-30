export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1>🚀 Tatum API Gateway</h1>
      
      <div style={{ backgroundColor: '#f5f5f5', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h2>Enterprise-Grade Blockchain API</h2>
        <p>This is a pure API Gateway. All endpoints return JSON.</p>
        <p><strong>Status:</strong> ✅ Running and ready to serve</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>📚 Documentation</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li><code>GET /</code> - API info and business model</li>
          <li><code>GET /api/docs</code> - Complete API documentation</li>
          <li><code>GET /api/docs/model</code> - Business model explanation</li>
          <li><code>GET /api/docs/examples</code> - Usage examples</li>
          <li><code>GET /api/test-tatum</code> - Test Tatum API connection</li>
        </ul>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>💰 Business Model</h3>
        <div style={{ backgroundColor: '#f0f0f0', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          <h4>CRYPTO Panel</h4>
          <ul>
            <li>0.5% commission on internal swaps</li>
            <li>40% markup on gas fees</li>
            <li>Full revenue tracking</li>
          </ul>
        </div>
        <div style={{ backgroundColor: '#f0f0f0', padding: '1rem', borderRadius: '4px' }}>
          <h4>RWA Panel</h4>
          <ul>
            <li>$500 setup fee per token</li>
            <li>$200 annual fee per token</li>
            <li>0.5% trading commissions</li>
          </ul>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>🔗 Quick Links</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li><a href="/api/docs" target="_blank" rel="noopener noreferrer">API Documentation</a></li>
          <li><a href="https://github.com/MasterFital/tatum-api-gateway" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
          <li><a href="https://docs.tatum.io" target="_blank" rel="noopener noreferrer">Tatum Docs</a></li>
        </ul>
      </div>

      <div style={{ backgroundColor: '#e8f5e9', padding: '1.5rem', borderRadius: '8px', marginTop: '2rem' }}>
        <h3>✅ Ready for Production</h3>
        <p>This API Gateway is fully configured and ready to:</p>
        <ul>
          <li>Handle Tatum blockchain operations</li>
          <li>Manage CRYPTO panel wallets and transactions</li>
          <li>Manage RWA token creation and trading</li>
          <li>Track admin revenue from all operations</li>
        </ul>
      </div>

      <footer style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #ddd', color: '#666', fontSize: '0.9rem' }}>
        <p>Tatum API Gateway v1.0.0 | Built with Node.js, Express, TypeScript</p>
      </footer>
    </div>
  )
}
