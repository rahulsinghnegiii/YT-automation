const { override, addBabelPlugin } = require('customize-cra');

module.exports = override(
  addBabelPlugin('@babel/plugin-proposal-optional-chaining'),
  addBabelPlugin('@babel/plugin-proposal-nullish-coalescing-operator'),
  (config, env) => {
    if (env === 'development') {
      // Configure development server settings
      config.devServer = {
        ...config.devServer,
        // Allow WebSocket connections (remove the blocking middleware)
        client: {
          webSocketURL: 'auto://0.0.0.0:0/ws',
        },
        // Configure proxy if needed
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
            ws: false, // Don't proxy WebSocket connections for /api
          },
          '/auth': {
            target: 'http://localhost:3000',
            changeOrigin: true,
            ws: false,
          },
          // Don't proxy socket.io - let the client connect directly to port 3000
        }
      };
    }
    return config;
  }
);
