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
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3001'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3001'],
  credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/downloads', express.static(path.join(__dirname, '../downloads')));
app.use('/processed', express.static(path.join(__dirname, '../processed')));

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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found',
    path: req.originalUrl,
    available: ['/', '/health', '/auth', '/api', '/upload', '/system']
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Socket.IO handling
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

// Server startup
async function startServer() {
  try {
    console.log('🚀 Starting AI Music Uploader Server...');
    
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
║ 🔐 Admin: ${(process.env.ADMIN_USERNAME + ' / ' + process.env.ADMIN_PASSWORD).padEnd(50)}║
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
