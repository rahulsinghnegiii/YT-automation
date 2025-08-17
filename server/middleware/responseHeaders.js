// Middleware to ensure proper response headers for all API responses
const responseHeaders = (req, res, next) => {
  // Debug CORS requests
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 CORS Debug: ${req.method} ${req.path}`);
    console.log(`   Origin: ${req.headers.origin || 'none'}`);
    console.log(`   User-Agent: ${req.headers['user-agent'] || 'none'}`);
  }
  
  // Set default JSON content type for API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/upload')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  
  // Ensure CORS headers are always set in development
  if (process.env.NODE_ENV === 'development') {
    const origin = req.headers.origin;
    
    // Always set CORS headers for localhost origins
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      console.log(`✅ CORS headers set for origin: ${origin}`);
    } else {
      // Fallback - allow any origin in development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      console.log(`⚠️  CORS fallback headers set (no origin or non-localhost)`);
    }
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      console.log(`🚀 OPTIONS preflight handled for ${req.path}`);
      return res.status(200).end();
    }
  }

  // Override res.json to ensure consistent response format
  const originalJson = res.json;
  res.json = function(body) {
    // Ensure Content-Type is set
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    // Ensure body is always an object
    if (typeof body === 'string') {
      body = { message: body };
    }

    // Add timestamp to all responses in development
    if (process.env.NODE_ENV === 'development') {
      if (typeof body === 'object' && body !== null) {
        body.timestamp = new Date().toISOString();
      }
    }

    return originalJson.call(this, body);
  };

  next();
};

module.exports = responseHeaders;
