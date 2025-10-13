import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());
// Parse URL-encoded bodies (for form data)
app.use(express.urlencoded({ extended: true }));

// Proxy all Cloudflare API requests
app.all(/^\/api\/cloudflare(?:\/(.*))?$/, async (req, res) => {
  try {
    // Extract everything after /api/cloudflare
    const cloudflareApiPath = req.params[0] ? `/${req.params[0]}` : '';
    
    // Build URL with query parameters
    const url = new URL(`https://api.cloudflare.com/client/v4${cloudflareApiPath}`);
    // Forward all query parameters from the original request
    Object.keys(req.query).forEach(key => {
      const value = req.query[key];
      // Handle both single values and arrays
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.append(key, String(value));
      }
    });
    const cloudflareUrl = url.toString();

    console.log(`[${req.method}] ${cloudflareUrl}`);
    console.log('Authorization header:', req.headers.authorization ? `${req.headers.authorization.substring(0, 20)}...` : 'MISSING');
    console.log('Query params received:', JSON.stringify(req.query));
    console.log('Final URL with params:', cloudflareUrl);
    console.log('Request body:', req.body);

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
      },
    };

    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(cloudflareUrl, fetchOptions);
    const data = await response.json();

    res.status(response.status).json(data);

    if (response.ok) {
      console.log(`✅ Success: ${response.status}`);
    } else {
      console.log(`❌ Error: ${response.status}`, data.errors?.[0]?.message || '');
      console.log('Full error response:', JSON.stringify(data, null, 2));
      console.log('Headers sent to Cloudflare:', JSON.stringify(fetchOptions.headers, null, 2));
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      success: false,
      errors: [{ message: 'Internal server error' }],
    });
  }
});


// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to test query parameter parsing
app.get('/debug/query', (req, res) => {
  res.json({
    query: req.query,
    url: req.url,
    originalUrl: req.originalUrl,
    params: req.params,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Cloudflare API proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying requests to: https://api.cloudflare.com/client/v4`);
});

