const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO only if enabled in environment
let io = null;
if (process.env.ENABLE_WEBSOCKETS !== 'false') {
  const socketCorsOptions = {
    origin: process.env.NODE_ENV === 'development' ? true : (process.env.ALLOWED_ORIGINS?.split(',') || []),
    methods: ['GET', 'POST'],
    credentials: true
  };
  
  io = socketIo(server, {
    cors: socketCorsOptions
  });
  console.log('✅ WebSocket (Socket.IO) enabled');
} else {
  console.log('ℹ️ WebSocket (Socket.IO) disabled via ENABLE_WEBSOCKETS=false');
}

const PORT = process.env.PORT || 3000;

// CORS configuration for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173'
    ];
    
    // In development, allow all localhost origins
    if (process.env.NODE_ENV === 'development') {
      // Allow any localhost or 127.0.0.1 origin
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      // Also check against allowed origins
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
    }
    
    // In production, only allow specific origins (configure as needed)
    if (process.env.NODE_ENV === 'production') {
      const productionOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (productionOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
    
    // Default allow for development
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Log CORS configuration for debugging
console.log('🌐 CORS Configuration Applied (Updated):');
console.log('- Development Mode:', process.env.NODE_ENV === 'development');
console.log('- Allowed Methods: GET, POST, PUT, DELETE, OPTIONS');
console.log('- Credentials Support: true');
console.log('- Dynamic Origin Support: enabled for localhost/*');
if (process.env.NODE_ENV === 'production') {
  console.log('- Production Origins:', process.env.ALLOWED_ORIGINS?.split(',') || 'none configured');
}

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

// Add response headers middleware
const responseHeaders = require('./middleware/responseHeaders');
app.use(responseHeaders);

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/downloads', express.static(path.join(__dirname, '../downloads')));
app.use('/processed', express.static(path.join(__dirname, '../processed')));

// Serve React Client Build in Production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, '../client/build')));
  console.log('✅ Serving React client from build directory');
}

// Load routes after basic setup
let authRoutes, apiRoutes, uploadRoutes, systemRoutes;

try {
  authRoutes = require('./routes/auth');
  apiRoutes = require('./routes/api');
  uploadRoutes = require('./routes/upload');
  systemRoutes = require('./routes/system');
  
  app.use('/auth', authRoutes);
  app.use('/api', apiRoutes);
  app.use('/upload', uploadRoutes);
  app.use('/api/system', systemRoutes);
} catch (routeError) {
  console.warn('Route loading warning:', routeError.message);
}

// Main dashboard
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'AI Music Uploader',
    version: '1.0.0',
    implementation: 'Pure JavaScript/Node.js',
    features: {
      assetHarvesting: 'YouTube & URL downloads',
      signalMorphology: 'Audio processing & effects',
      semanticEnrichment: 'Text enhancement & metadata',
      youtubeUpload: 'Automated video uploads',
      realTimeMonitoring: 'System metrics & WebSocket',
      taskScheduling: 'Automated workflows'
    },
    endpoints: {
      authentication: '/auth',
      api: '/api',
      upload: '/upload',
      system: '/system'
    },
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
});

// Catch-all handler: send back React's index.html file in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    // Don't catch API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/upload') || req.path.startsWith('/health')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Import centralized error handling
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Apply error handling middleware (only in development or for API routes)
if (process.env.NODE_ENV !== 'production') {
  app.use(notFoundHandler);
}
app.use(errorHandler);

// Socket.IO handling (only if enabled)
if (io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    socket.emit('welcome', { 
      message: 'Connected to AI Music Uploader',
      timestamp: new Date().toISOString(),
      features: ['Real-time monitoring', 'Live updates', 'System metrics']
    });
    
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

// Server startup
async function startServer() {
  try {
    console.log('🚀 Starting AI Music Uploader Server...');
    
    // Validate environment variables
    const { validateOrExit } = require('./utils/envValidator');
    const validation = validateOrExit({ strict: false });
    console.log(''); // Add spacing
    
    // Try to initialize database
    try {
      const { sequelize } = require('./models');
      await sequelize.authenticate();
      console.log('✅ Database connection established');
      
      await sequelize.sync({ force: false });
      console.log('✅ Database models synchronized');

      // Seed database with initial data
      const { seedDatabase } = require('./utils/seedDatabase');
      await seedDatabase();
      
    } catch (dbError) {
      console.warn('⚠️ Database warning:', dbError.message);
    }

    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                 🎵 AI MUSIC UPLOADER 🎵                      ║
║                 Pure JavaScript Implementation                ║
╠═══════════════════════════════════════════════════════════════╣
║ 🚀 Status: ONLINE                                           ║
║ 📡 Port: ${PORT.toString().padEnd(53)}║
║ 🔐 Admin: ${(process.env.ADMIN_USERNAME + ' / ' + '*'.repeat(Math.min(process.env.ADMIN_PASSWORD?.length || 8, 12))).padEnd(50)}║
║ 📊 Dashboard: http://localhost:${PORT.toString().padEnd(38)}║
║ 🔗 Health: http://localhost:${PORT}/health${' '.repeat(26)}║
║                                                              ║
║ ⚡ FEATURES ACTIVE:                                          ║
║   • Asset Harvesting (YouTube/URL)                          ║
║   • Signal Morphology (Audio Processing)                    ║
║   • Semantic Enrichment (Text Enhancement)                  ║
║   • YouTube Upload (Automated)                              ║
║   • Real-time Monitoring                                    ║
║   • Task Scheduling                                         ║
╚═══════════════════════════════════════════════════════════════╝
      `);

      // Initialize services safely
      setTimeout(async () => {
        try {
          const { initializeRealTimeMonitoring } = require('./services/monitoring');
          const { initializeScheduler } = require('./services/scheduler');
          
          initializeRealTimeMonitoring(io);
          console.log('✅ Real-time monitoring active');
          
          await initializeScheduler();
          console.log('✅ Task scheduler active');
          
          console.log('🎉 All systems operational');
        } catch (serviceError) {
          console.warn('⚠️ Service warning:', serviceError.message);
        }
      }, 1000);
    });

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  console.log(`🛑 Shutting down (${signal})...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    try {
      const { sequelize } = require('./models');
      sequelize.close().then(() => {
        console.log('✅ Database closed');
        process.exit(0);
      });
    } catch {
      process.exit(0);
    }
  });
}

startServer();
