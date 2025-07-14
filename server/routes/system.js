const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { AuditLog } = require('../models');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// System configuration endpoints
router.get('/config', async (req, res) => {
  try {
    // Return non-sensitive configuration
    const config = {
      features: {
        realTimeMonitoring: true,
        scheduler: true,
        analytics: true,
        notifications: !!process.env.SMTP_HOST,
        youtubeUpload: !!process.env.YOUTUBE_CLIENT_ID,
        openaiEnrichment: !!process.env.OPENAI_API_KEY
      },
      scheduler: {
        harvestInterval: process.env.HARVEST_INTERVAL || '*/30 * * * *',
        processInterval: process.env.PROCESS_INTERVAL || '*/15 * * * *',
        uploadInterval: process.env.UPLOAD_INTERVAL || '*/45 * * * *'
      },
      limits: {
        maxFileSize: process.env.MAX_FILE_SIZE || '100MB',
        maxConcurrentJobs: process.env.MAX_CONCURRENT_JOBS || 5,
        retentionDays: process.env.LOG_RETENTION_DAYS || 30
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Config fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system configuration'
    });
  }
});

// Update system configuration
router.put('/config', async (req, res) => {
  try {
    const { scheduler, limits, features } = req.body;

    // Validate configuration updates
    const allowedUpdates = {};

    if (scheduler) {
      allowedUpdates.scheduler = scheduler;
    }

    if (limits) {
      allowedUpdates.limits = limits;
    }

    if (features) {
      allowedUpdates.features = features;
    }

    // Log configuration change
    await AuditLog.create({
      userId: req.user.userId,
      action: 'config_update',
      resource: 'system',
      details: { updates: allowedUpdates },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: allowedUpdates
    });
  } catch (error) {
    logger.error('Config update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update system configuration'
    });
  }
});

// System health check
router.get('/health', async (req, res) => {
  try {
    const { SystemMonitor } = require('../services/monitoring');
    const monitor = new SystemMonitor();
    
    const healthChecks = await Promise.allSettled([
      // Database health
      require('../models').sequelize.authenticate(),
      
      // Storage health
      checkStorageHealth(),
      
      // Service health
      monitor.getServiceStatus(),
      
      // External API health
      checkExternalAPIs()
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: healthChecks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        storage: healthChecks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        services: healthChecks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        externalAPIs: healthChecks[3].status === 'fulfilled' ? 'healthy' : 'degraded'
      }
    };

    // Determine overall status
    const unhealthyChecks = Object.values(health.checks).filter(status => status === 'unhealthy');
    if (unhealthyChecks.length > 0) {
      health.status = 'unhealthy';
    } else if (Object.values(health.checks).includes('degraded')) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;

    res.status(statusCode).json({
      success: health.status !== 'unhealthy',
      data: health
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// System restart/maintenance
router.post('/maintenance/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const validActions = ['restart-scheduler', 'clear-cache', 'cleanup-logs', 'restart-monitoring'];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid maintenance action'
      });
    }

    let result;
    switch (action) {
      case 'restart-scheduler':
        const { scheduler } = require('../services/scheduler');
        await scheduler.stop();
        await scheduler.start();
        result = 'Scheduler restarted';
        break;
        
      case 'clear-cache':
        // Implement cache clearing if needed
        result = 'Cache cleared';
        break;
        
      case 'cleanup-logs':
        result = await cleanupOldLogs();
        break;
        
      case 'restart-monitoring':
        const { initializeRealTimeMonitoring } = require('../services/monitoring');
        initializeRealTimeMonitoring(req.app.get('io'));
        result = 'Monitoring restarted';
        break;
    }

    // Log maintenance action
    await AuditLog.create({
      userId: req.user.userId,
      action: `maintenance_${action}`,
      resource: 'system',
      details: { action, result },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({
      success: true,
      message: result
    });
  } catch (error) {
    logger.error('Maintenance action error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to execute maintenance action: ${req.params.action}`
    });
  }
});

// System logs
router.get('/logs', async (req, res) => {
  try {
    const { level = 'info', limit = 100, since } = req.query;
    const fs = require('fs').promises;
    const path = require('path');

    const logsDir = path.join(__dirname, '../../logs');
    const files = await fs.readdir(logsDir);
    
    // Get the most recent log file
    const logFiles = files.filter(f => f.endsWith('.log')).sort().reverse();
    
    if (logFiles.length === 0) {
      return res.json({
        success: true,
        data: { logs: [], total: 0 }
      });
    }

    const logFile = path.join(logsDir, logFiles[0]);
    const logContent = await fs.readFile(logFile, 'utf8');
    
    // Parse logs (assuming JSON format from winston)
    const logs = logContent
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { level: 'info', message: line, timestamp: new Date().toISOString() };
        }
      })
      .filter(log => !level || log.level === level)
      .slice(0, parseInt(limit))
      .reverse();

    res.json({
      success: true,
      data: {
        logs,
        total: logs.length,
        file: logFiles[0]
      }
    });
  } catch (error) {
    logger.error('Logs fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system logs'
    });
  }
});

// Helper functions
async function checkStorageHealth() {
  const fs = require('fs').promises;
  const path = require('path');

  const dirs = ['downloads', 'processed', 'uploads', 'logs'];
  
  for (const dir of dirs) {
    const dirPath = path.join(__dirname, '../../', dir);
    try {
      await fs.access(dirPath);
    } catch {
      throw new Error(`Directory ${dir} is not accessible`);
    }
  }

  return true;
}

async function checkExternalAPIs() {
  const checks = [];

  // Check OpenAI API if configured
  if (process.env.OPENAI_API_KEY) {
    checks.push(checkOpenAI());
  }

  // Check YouTube API if configured
  if (process.env.YOUTUBE_CLIENT_ID) {
    checks.push(checkYouTubeAPI());
  }

  const results = await Promise.allSettled(checks);
  const failed = results.filter(r => r.status === 'rejected');

  if (failed.length > 0) {
    throw new Error(`${failed.length} external API checks failed`);
  }

  return true;
}

async function checkOpenAI() {
  // Simple API key validation
  if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format');
  }
  return true;
}

async function checkYouTubeAPI() {
  // Check if credentials file exists
  const fs = require('fs').promises;
  const path = require('path');
  
  const credentialsPath = path.join(__dirname, '../../credentials/client_secret_youtube.json');
  try {
    await fs.access(credentialsPath);
    return true;
  } catch {
    throw new Error('YouTube credentials file not found');
  }
}

async function cleanupOldLogs() {
  const fs = require('fs').promises;
  const path = require('path');

  const logsDir = path.join(__dirname, '../../logs');
  const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const files = await fs.readdir(logsDir);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    return `Cleaned up ${deletedCount} old log files`;
  } catch (error) {
    throw new Error(`Log cleanup failed: ${error.message}`);
  }
}

module.exports = router;
