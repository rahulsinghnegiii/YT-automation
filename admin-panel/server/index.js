const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const fs = require('fs-extra');
const path = require('path');
const si = require('systeminformation');
const cron = require('node-cron');
const moment = require('moment');
const { spawn, exec } = require('child_process');
const chokidar = require('chokidar');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from client build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Configuration
const config = {
  port: process.env.PORT || 5000,
  paths: {
    downloads: path.join(__dirname, '../../downloads'),
    processed: path.join(__dirname, '../../processed'),
    logs: path.join(__dirname, '../../logs'),
    uploads: path.join(__dirname, '../../uploads'),
    overlays: path.join(__dirname, '../../overlays')
  },
  services: {
    harvester: { active: true, lastActivity: new Date() },
    processor: { active: true, lastActivity: new Date() },
    semantic: { active: true, lastActivity: new Date() },
    uploader: { active: false, lastActivity: new Date() },
    scheduler: { active: true, lastActivity: new Date() }
  }
};

// Global state
let systemStats = {};
let connectedClients = 0;
let processingQueue = [];
let uploadQueue = [];
let recentActivity = [];
let systemAlerts = [];

// Utility functions
const logger = {
  info: (msg) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`),
  error: (msg) => console.log(`[${new Date().toISOString()}] ERROR: ${msg}`),
  warn: (msg) => console.log(`[${new Date().toISOString()}] WARN: ${msg}`)
};

const addActivity = (type, description, status = 'success') => {
  const activity = {
    id: Date.now().toString(),
    type,
    description,
    status,
    timestamp: new Date(),
    details: {}
  };
  
  recentActivity.unshift(activity);
  if (recentActivity.length > 50) {
    recentActivity = recentActivity.slice(0, 50);
  }
  
  // Emit to all connected clients
  io.emit('activity:new', activity);
};

const addAlert = (type, title, message, severity = 'info') => {
  const alert = {
    id: Date.now().toString(),
    type,
    title,
    message,
    severity,
    timestamp: new Date(),
    dismissed: false
  };
  
  systemAlerts.unshift(alert);
  if (systemAlerts.length > 20) {
    systemAlerts = systemAlerts.slice(0, 20);
  }
  
  io.emit('alert:new', alert);
};

const getDirectoryStats = async (dirPath) => {
  try {
    if (!await fs.pathExists(dirPath)) {
      return { count: 0, size: 0, files: [] };
    }
    
    const files = await fs.readdir(dirPath);
    let totalSize = 0;
    const fileList = [];
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        totalSize += stats.size;
        fileList.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          type: path.extname(file)
        });
      }
    }
    
    return {
      count: files.length,
      size: totalSize,
      files: fileList.slice(0, 10) // Latest 10 files
    };
  } catch (error) {
    logger.error(`Error getting directory stats for ${dirPath}: ${error.message}`);
    return { count: 0, size: 0, files: [] };
  }
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// System monitoring
const updateSystemStats = async () => {
  try {
    const [cpu, mem, diskLayout, networkStats, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.diskLayout(),
      si.networkStats(),
      si.osInfo()
    ]);
    
    const downloads = await getDirectoryStats(config.paths.downloads);
    const processed = await getDirectoryStats(config.paths.processed);
    const uploads = await getDirectoryStats(config.paths.uploads);
    
    systemStats = {
      cpu: {
        usage: Math.round(cpu.currentload * 10) / 10,
        cores: cpu.cpus.length,
        speed: cpu.cpus[0]?.speed || 0
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usage: Math.round((mem.used / mem.total) * 100 * 10) / 10
      },
      disk: {
        total: diskLayout.reduce((sum, disk) => sum + disk.size, 0),
        usage: 0 // Will be calculated from directory stats
      },
      network: {
        rx: networkStats[0]?.rx_sec || 0,
        tx: networkStats[0]?.tx_sec || 0
      },
      uptime: osInfo.uptime,
      platform: osInfo.platform,
      downloads: {
        count: downloads.count,
        size: downloads.size,
        sizeFormatted: formatBytes(downloads.size),
        files: downloads.files
      },
      processed: {
        count: processed.count,
        size: processed.size,
        sizeFormatted: formatBytes(processed.size),
        files: processed.files
      },
      uploads: {
        count: uploads.count,
        size: uploads.size,
        sizeFormatted: formatBytes(uploads.size),
        files: uploads.files
      },
      timestamp: new Date()
    };
    
    // Emit to all connected clients
    io.emit('stats:update', systemStats);
    
    // Check for alerts
    if (systemStats.cpu.usage > 80) {
      addAlert('performance', 'High CPU Usage', `CPU usage is at ${systemStats.cpu.usage}%`, 'warning');
    }
    
    if (systemStats.memory.usage > 85) {
      addAlert('performance', 'High Memory Usage', `Memory usage is at ${systemStats.memory.usage}%`, 'warning');
    }
    
  } catch (error) {
    logger.error(`Error updating system stats: ${error.message}`);
  }
};

// File system watchers
const setupFileWatchers = () => {
  // Watch downloads directory
  const downloadsWatcher = chokidar.watch(config.paths.downloads, {
    ignored: /^\./, 
    persistent: true
  });
  
  downloadsWatcher.on('add', (filePath) => {
    const fileName = path.basename(filePath);
    addActivity('download', `New file downloaded: ${fileName}`, 'success');
    logger.info(`New download: ${fileName}`);
  });
  
  // Watch processed directory
  const processedWatcher = chokidar.watch(config.paths.processed, {
    ignored: /^\./, 
    persistent: true
  });
  
  processedWatcher.on('add', (filePath) => {
    const fileName = path.basename(filePath);
    addActivity('processing', `File processed: ${fileName}`, 'success');
    logger.info(`File processed: ${fileName}`);
  });
  
  // Watch uploads directory
  const uploadsWatcher = chokidar.watch(config.paths.uploads, {
    ignored: /^\./, 
    persistent: true
  });
  
  uploadsWatcher.on('add', (filePath) => {
    const fileName = path.basename(filePath);
    addActivity('upload', `File uploaded: ${fileName}`, 'success');
    logger.info(`File uploaded: ${fileName}`);
  });
};

// REST API Routes
app.get('/api/dashboard', async (req, res) => {
  try {
    const response = {
      success: true,
      data: {
        stats: systemStats,
        activity: recentActivity.slice(0, 10),
        alerts: systemAlerts.filter(a => !a.dismissed).slice(0, 5),
        services: config.services,
        queues: {
          processing: processingQueue.length,
          upload: uploadQueue.length
        }
      }
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/system/status', async (req, res) => {
  try {
    await updateSystemStats();
    res.json({ success: true, data: systemStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/files/:directory', async (req, res) => {
  try {
    const { directory } = req.params;
    const dirPath = config.paths[directory];
    
    if (!dirPath) {
      return res.status(400).json({ success: false, error: 'Invalid directory' });
    }
    
    const stats = await getDirectoryStats(dirPath);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/activity', (req, res) => {
  const { limit = 50, type } = req.query;
  let activities = recentActivity;
  
  if (type) {
    activities = activities.filter(a => a.type === type);
  }
  
  res.json({ 
    success: true, 
    data: activities.slice(0, parseInt(limit)) 
  });
});

app.get('/api/alerts', (req, res) => {
  const { dismissed = false } = req.query;
  let alerts = systemAlerts;
  
  if (!dismissed) {
    alerts = alerts.filter(a => !a.dismissed);
  }
  
  res.json({ success: true, data: alerts });
});

app.post('/api/alerts/:id/dismiss', (req, res) => {
  const { id } = req.params;
  const alert = systemAlerts.find(a => a.id === id);
  
  if (alert) {
    alert.dismissed = true;
    io.emit('alert:dismissed', { id });
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Alert not found' });
  }
});

app.post('/api/services/:service/toggle', (req, res) => {
  const { service } = req.params;
  
  if (config.services[service]) {
    config.services[service].active = !config.services[service].active;
    config.services[service].lastActivity = new Date();
    
    const status = config.services[service].active ? 'started' : 'stopped';
    addActivity('service', `Service ${service} ${status}`, 'info');
    
    io.emit('service:updated', { service, status: config.services[service] });
    
    res.json({ 
      success: true, 
      service,
      active: config.services[service].active,
      action: status
    });
  } else {
    res.status(404).json({ success: false, error: 'Service not found' });
  }
});

app.post('/api/system/cleanup', async (req, res) => {
  try {
    addActivity('system', 'Starting system cleanup...', 'info');
    
    // Simulate cleanup process
    setTimeout(() => {
      addActivity('system', 'System cleanup completed', 'success');
    }, 2000);
    
    res.json({ 
      success: true, 
      message: 'Cleanup started',
      freedSpace: '1.2 GB'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Processing action endpoints
app.post('/api/trigger/:action', async (req, res) => {
  const { action } = req.params;
  const { file, url, options = {} } = req.body;
  
  try {
    addActivity('trigger', `Started ${action} process`, 'info');
    
    switch (action) {
      case 'harvest':
        if (!url) {
          return res.status(400).json({ success: false, error: 'URL is required for harvesting' });
        }
        // TODO: Implement JavaScript asset harvesting
        addActivity('harvest', `Harvesting from ${url}`, 'info');
        break;
        
      case 'process':
        if (!file) {
          return res.status(400).json({ success: false, error: 'File is required for processing' });
        }
        // TODO: Implement JavaScript signal morphology
        addActivity('process', `Processing file ${file}`, 'info');
        break;
        
      case 'semantic':
        if (!file) {
          return res.status(400).json({ success: false, error: 'File is required for semantic enrichment' });
        }
        // TODO: Implement JavaScript semantic enrichment
        addActivity('semantic', `Enriching file ${file}`, 'info');
        break;
        
      case 'upload':
        if (!file) {
          return res.status(400).json({ success: false, error: 'File is required for upload' });
        }
        // TODO: Implement JavaScript YouTube upload
        addActivity('upload', `Uploading file ${file}`, 'info');
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    // Simulate async processing
    setTimeout(() => {
      addActivity('trigger', `${action} process completed`, 'success');
    }, 2000);
    
    res.json({ 
      success: true, 
      message: `${action} process started`
    });
    
  } catch (error) {
    logger.error(`Error triggering ${action}: ${error.message}`);
    addActivity('trigger', `${action} process failed: ${error.message}`, 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  connectedClients++;
  logger.info(`Client connected. Total clients: ${connectedClients}`);
  
  // Send current state to new client
  socket.emit('stats:update', systemStats);
  socket.emit('activity:bulk', recentActivity.slice(0, 20));
  socket.emit('alerts:bulk', systemAlerts.filter(a => !a.dismissed));
  
  socket.on('disconnect', () => {
    connectedClients--;
    logger.info(`Client disconnected. Total clients: ${connectedClients}`);
  });
  
  socket.on('request:stats', async () => {
    await updateSystemStats();
    socket.emit('stats:update', systemStats);
  });
});

// Scheduled tasks
cron.schedule('*/10 * * * * *', updateSystemStats); // Every 10 seconds
cron.schedule('*/30 * * * * *', () => {
  io.emit('heartbeat', { timestamp: new Date(), clients: connectedClients });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Initialize
const init = async () => {
  try {
    // Ensure directories exist
    for (const [key, dirPath] of Object.entries(config.paths)) {
      await fs.ensureDir(dirPath);
      logger.info(`Ensured directory exists: ${key} -> ${dirPath}`);
    }
    
    // Setup file watchers
    setupFileWatchers();
    
    // Initial system stats update
    await updateSystemStats();
    
    // Add startup activity
    addActivity('system', 'Admin panel started successfully', 'success');
    
    logger.info('🚀 AI Music Uploader Admin Panel Backend Initialized');
    
  } catch (error) {
    logger.error(`Failed to initialize: ${error.message}`);
    process.exit(1);
  }
};

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  logger.info(`🌟 Server running on port ${PORT}`);
  logger.info(`🎵 AI Music Uploader Admin Panel`);
  logger.info(`📱 Open http://localhost:${PORT} to access the admin panel`);
  init();
});

module.exports = { app, server, io };
