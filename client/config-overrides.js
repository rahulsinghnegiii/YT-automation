const { override, addBabelPlugin } = require('customize-cra');

module.exports = override(
  addBabelPlugin('@babel/plugin-proposal-optional-chaining'),
  addBabelPlugin('@babel/plugin-proposal-nullish-coalescing-operator'),
  (config, env) => {
    if (env === 'development') {
      // Configure proxy to exclude WebSocket connections
      config.devServer = {
        ...config.devServer,
        setupMiddlewares: (middlewares, devServer) => {
          // Don't proxy WebSocket connections
          devServer.app.use('/socket.io/', (req, res, next) => {
            res.status(404).send('WebSocket endpoint not proxied');
          });
          return middlewares;
        }
      };
    }
    return config;
  }
);
