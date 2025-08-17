const express = require('express');
const path = require('path');
const { Asset, Upload, ProcessingJob, SystemMetric, AuditLog } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, createNotFoundError, createValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { scheduler } = require('../services/scheduler');

const router = express.Router();

// Import mock data conditionally with verbose logging
let mockAssets, mockScheduler, mockAnalytics;
console.log('[Mock Data Loader] Checking environment variables:');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  - USE_MOCK_DATA: ${process.env.USE_MOCK_DATA}`);

if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_DATA === 'true') {
  console.log('[Mock Data Loader] Attempting to load mock data files...');
  
  // Load assets mock data
  try {
    mockAssets = require('../../mock/assets');
    console.log('[Mock Data Loader] ✅ Successfully loaded mock/assets.js');
    console.log(`  - Available functions: ${Object.keys(mockAssets).join(', ')}`);
  } catch (error) {
    console.error('[Mock Data Loader] ❌ Failed to load mock/assets.js:', error.message);
    console.error('[Mock Data Loader] Stack trace:', error.stack);
  }
  
  // Load scheduler mock data
  try {
    mockScheduler = require('../../mock/scheduler');
    console.log('[Mock Data Loader] ✅ Successfully loaded mock/scheduler.js');
  } catch (error) {
    console.error('[Mock Data Loader] ❌ Failed to load mock/scheduler.js:', error.message);
  }
  
  // Load analytics mock data
  try {
    mockAnalytics = require('../../mock/analytics');
    console.log('[Mock Data Loader] ✅ Successfully loaded mock/analytics.js');
  } catch (error) {
    console.error('[Mock Data Loader] ❌ Failed to load mock/analytics.js:', error.message);
  }
  
  console.log('[Mock Data Loader] Mock data loading complete.');
  logger.info('Mock data loading attempted for development/mock environment');
} else {
  console.log('[Mock Data Loader] Skipping mock data - not in development mode');
}

// Apply authentication to all routes
router.use(authenticateToken);

// Dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  // Use mock data in development
  if (isDevelopment || useMockData) {
    try {
      logger.info('[/api/dashboard/stats] Using mock data');
      const mockStats = getMockDashboardStats();
      return res.json({
        success: true,
        data: mockStats
      });
    } catch (error) {
      logger.error('[/api/dashboard/stats] Mock data failed:', error);
      return res.status(500).json({ error: 'Mock data load failed' });
    }
  }

  try {
    const stats = await getDashboardStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

// Dashboard metrics history
router.get('/dashboard/metrics-history', async (req, res) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  // Use mock data in development
  if (isDevelopment || useMockData) {
    try {
      logger.info('[/api/dashboard/metrics-history] Using mock data');
      const mockMetrics = getMockMetricsHistory(parseInt(req.query.limit) || 50);
      return res.json({
        success: true,
        data: mockMetrics
      });
    } catch (error) {
      logger.error('[/api/dashboard/metrics-history] Mock data failed:', error);
      return res.status(500).json({ error: 'Mock data load failed' });
    }
  }

  try {
    const limit = parseInt(req.query.limit) || 50;
    const metrics = await SystemMetric.findAll({
      order: [['timestamp', 'DESC']],
      limit: limit,
      attributes: ['timestamp', 'cpuPercent', 'memoryPercent', 'diskPercent', 'networkBytesIn', 'networkBytesOut']
    });
    
    res.json({
      success: true,
      data: metrics.reverse() // Reverse to get chronological order
    });
  } catch (error) {
    logger.error('Dashboard metrics history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics history'
    });
  }
});

// Dashboard recent activity
router.get('/dashboard/recent-activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // Get recent audit logs as activity - simplified to avoid association issues
    const activities = await AuditLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: limit,
      attributes: ['id', 'action', 'resource', 'details', 'success', 'createdAt']
    });
    
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      type: activity.action,
      description: getActivityDescription(activity),
      status: activity.success ? 'success' : 'error',
      timestamp: activity.createdAt,
      user: activity.details?.username || 'System'
    }));
    
    res.json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    logger.error('Dashboard recent activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activity',
      data: [] // Return empty array on error to prevent frontend crashes
    });
  }
});

// System status
router.get('/status', async (req, res) => {
  try {
    const { SystemMonitor } = require('../services/monitoring');
    const monitor = new SystemMonitor();
    
    const [currentMetrics, serviceStatus] = await Promise.all([
      monitor.getCurrentMetrics(),
      monitor.getServiceStatus()
    ]);

    res.json({
      success: true,
      data: {
        metrics: currentMetrics,
        services: serviceStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system status'
    });
  }
});

// Assets management
router.get('/assets', asyncHandler(async (req, res) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  // Verbose logging
  logger.info('[/api/assets] route handler invoked');
  logger.info(`  - NODE_ENV: ${process.env.NODE_ENV}`)
  logger.info(`  - USE_MOCK_DATA: ${process.env.USE_MOCK_DATA}`);

  if (isDevelopment || useMockData) {
    try {
      const { mockAssetsPaginated } = require('../../mock/assets');
      logger.info('  - Using mock data branch for /api/assets');

      const { page = 1, limit = 20, status, type } = req.query;
      const mockData = mockAssetsPaginated(parseInt(page), parseInt(limit), status, type);
      
      return res.json(mockData);
    } catch (error) {
      logger.error('  - Mock data load failed for /api/assets:', error);
      return res.status(500).json({ error: 'Mock data load failed' });
    }
  }

  // Production logic (no changes needed here)
  const { page = 1, limit = 20, status, type } = req.query;
  const offset = (page - 1) * limit;
  
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const { count, rows: assets } = await Asset.findAndCountAll({
    where,
    include: [
      { model: ProcessingJob, as: 'jobs' },
      { model: Upload, as: 'uploads' }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: {
      assets,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    }
  });
}));

// Single asset details
router.get('/assets/:id', async (req, res) => {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const useMockData = process.env.USE_MOCK_DATA === 'true';

    // Mock mode handling
    if (isDevelopment || useMockData) {
      try {
        const { mockAssetById } = require('../../mock/assets');
        const mockAsset = mockAssetById(req.params.id);
        
        if (!mockAsset) {
          return res.status(404).json({
            success: false,
            error: 'Asset not found'
          });
        }
        
        return res.json({
          success: true,
          data: mockAsset
        });
      } catch (mockError) {
        logger.error('Mock asset details failed:', mockError);
      }
    }

    const asset = await Asset.findByPk(req.params.id, {
      include: [
        { model: ProcessingJob, as: 'jobs' },
        { model: Upload, as: 'uploads' }
      ]
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    res.json({
      success: true,
      data: asset
    });
  } catch (error) {
    logger.error('Asset details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch asset details'
    });
  }
});

// Delete asset
router.delete('/assets/:id', asyncHandler(async (req, res) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  // Mock mode handling
  if (isDevelopment || useMockData) {
    logger.info(`Mock delete asset ${req.params.id}`);
    
    // Log the mock deletion
    await AuditLog.create({
      userId: req.user?.userId || 1,
      action: 'asset_deleted',
      resource: 'asset',
      resourceId: req.params.id,
      details: { assetId: req.params.id, mock: true },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    }).catch(() => {}); // Ignore audit log errors in mock mode
    
    return res.json({
      success: true,
      message: 'Asset deleted successfully (Mock Mode)',
      data: { id: req.params.id, mock: true }
    });
  }

  const asset = await Asset.findByPk(req.params.id);
  
  if (!asset) {
    return createNotFoundError('Asset not found');
  }

  // Delete associated files
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    if (asset.originalPath) {
      await fs.unlink(asset.originalPath);
    }
    if (asset.processedPath && asset.processedPath !== asset.originalPath) {
      await fs.unlink(asset.processedPath);
    }
  } catch (fileError) {
    logger.warn('File deletion warning:', fileError.message);
  }

  // Delete associated processing jobs and uploads
  await ProcessingJob.destroy({ where: { assetId: asset.id } });
  await Upload.destroy({ where: { assetId: asset.id } });
  
  // Delete the asset record
  await asset.destroy();
  
  // Log the deletion
  await AuditLog.create({
    userId: req.user.userId,
    action: 'asset_deleted',
    resource: 'asset',
    resourceId: asset.id,
    details: { filename: asset.filename, originalPath: asset.originalPath },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    success: true
  });

  res.json({
    success: true,
    message: 'Asset deleted successfully',
    data: { id: asset.id }
  });
}));

// Update asset
router.put('/assets/:id', asyncHandler(async (req, res) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  // Mock mode handling
  if (isDevelopment || useMockData) {
    logger.info(`Mock update asset ${req.params.id}`);
    
    // Simulate asset update in mock mode
    const { mockAssetById } = require('../../mock/assets');
    const mockAsset = mockAssetById(req.params.id);
    
    if (!mockAsset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    // Merge update data with mock asset (simulate update)
    const updatedAsset = {
      ...mockAsset,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    // Log the mock update
    await AuditLog.create({
      userId: req.user?.userId || 1,
      action: 'asset_updated',
      resource: 'asset',
      resourceId: req.params.id,
      details: { 
        assetId: req.params.id, 
        updates: req.body,
        mock: true 
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    }).catch(() => {}); // Ignore audit log errors in mock mode
    
    return res.json({
      success: true,
      message: 'Asset updated successfully (Mock Mode)',
      data: updatedAsset
    });
  }

  // Production logic
  const asset = await Asset.findByPk(req.params.id);
  
  if (!asset) {
    return createNotFoundError('Asset not found');
  }

  // Update asset with provided data
  const allowedUpdates = ['filename', 'status', 'type', 'metadata', 'processingMetadata', 'tags'];
  const updateData = {};
  
  // Only update allowed fields
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }
  
  await asset.update(updateData);
  
  // Log the update
  await AuditLog.create({
    userId: req.user.userId,
    action: 'asset_updated',
    resource: 'asset',
    resourceId: asset.id,
    details: { 
      filename: asset.filename, 
      updates: updateData 
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    success: true
  });

  // Reload asset to get updated data
  await asset.reload({
    include: [
      { model: ProcessingJob, as: 'jobs' },
      { model: Upload, as: 'uploads' }
    ]
  });

  res.json({
    success: true,
    message: 'Asset updated successfully',
    data: asset
  });
}));

// Download asset
router.get('/assets/:id/download', asyncHandler(async (req, res) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  // Mock mode handling
  if (isDevelopment || useMockData) {
    logger.info(`Mock download asset ${req.params.id}`);
    
    // Create a mock file response
    const mockData = Buffer.from(`Mock audio file data for asset ${req.params.id}`, 'utf8');
    
    res.setHeader('Content-Disposition', `attachment; filename="mock-asset-${req.params.id}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', mockData.length);
    
    return res.send(mockData);
  }

  const asset = await Asset.findByPk(req.params.id);
  
  if (!asset) {
    return createNotFoundError('Asset not found');
  }

  const filePath = asset.processedPath || asset.originalPath;
  
  if (!filePath) {
    return res.status(400).json({
      success: false,
      error: 'No file available for download'
    });
  }

  const fs = require('fs');
  const path = require('path');
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: 'File not found on disk'
    });
  }

  // Get file stats
  const stat = fs.statSync(filePath);
  const filename = path.basename(filePath);
  
  // Set headers for file download
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
  
  // Log the download
  await AuditLog.create({
    userId: req.user.userId,
    action: 'asset_downloaded',
    resource: 'asset',
    resourceId: asset.id,
    details: { filename: asset.filename },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    success: true
  }).catch(() => {}); // Don't fail download if audit log fails
}));

// Processing jobs
router.get('/jobs', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const { count, rows: jobs } = await ProcessingJob.findAndCountAll({
      where,
      include: [{ model: Asset, as: 'asset' }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch processing jobs'
    });
  }
});

// Uploads
router.get('/uploads', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, platform } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (status) where.status = status;
    if (platform) where.platform = platform;

    const { count, rows: uploads } = await Upload.findAndCountAll({
      where,
      include: [{ model: Asset, as: 'asset' }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        uploads,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Uploads error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch uploads'
    });
  }
});

// Scheduler management
router.get('/scheduler/status', async (req, res) => {
  try {
    // Use mock data in development if available
    if (process.env.NODE_ENV === 'development' && mockScheduler) {
      const mockData = mockScheduler.mockSchedulerStatus;
      return res.json(mockData);
    }

    if (!scheduler.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler not yet initialized'
      });
    }
    
    const status = scheduler.getAllJobsStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Scheduler status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduler status'
    });
  }
});

// Get scheduler configuration
router.get('/scheduler/config', async (req, res) => {
  try {
    // Use mock data in development if available
    if (process.env.NODE_ENV === 'development' && mockScheduler) {
      const mockData = mockScheduler.mockSchedulerConfig;
      return res.json(mockData);
    }

    if (!scheduler.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler not yet initialized'
      });
    }
    
    const config = scheduler.getConfig();

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Scheduler config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduler configuration'
    });
  }
});

// Update scheduler configuration
router.put('/scheduler/config', async (req, res) => {
  try {
    if (!scheduler.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler not yet initialized'
      });
    }
    
    const config = await scheduler.updateConfig(req.body);

    // Log the configuration change
    await AuditLog.create({
      userId: req.user.userId,
      action: 'scheduler_config_update',
      resource: 'scheduler',
      details: req.body,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: config
    });
  } catch (error) {
    logger.error('Scheduler config update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scheduler configuration'
    });
  }
});

// Start/stop individual jobs
router.post('/scheduler/jobs/:jobName/:action', async (req, res) => {
  try {
    const { jobName, action } = req.params;
    
    if (!scheduler.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler not yet initialized'
      });
    }

    let result;
    let message;

    if (action === 'start') {
      result = scheduler.startJob(jobName);
      message = result ? `Job ${jobName} started successfully` : `Failed to start job ${jobName}`;
    } else if (action === 'stop') {
      result = scheduler.stopJob(jobName);
      message = result ? `Job ${jobName} stopped successfully` : `Failed to stop job ${jobName}`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "start" or "stop"'
      });
    }

    if (result) {
      // Log the job control action
      await AuditLog.create({
        userId: req.user.userId,
        action: `scheduler_job_${action}`,
        resource: 'scheduler',
        details: { jobName, action },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      });
    }

    res.json({
      success: result,
      message
    });
  } catch (error) {
    logger.error('Scheduler job control error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to ${req.params.action} job ${req.params.jobName}`
    });
  }
});

// Trigger individual jobs
router.post('/scheduler/jobs/:jobName/trigger', async (req, res) => {
  try {
    const { jobName } = req.params;
    
    if (!scheduler.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler not yet initialized'
      });
    }

    let result;
    switch (jobName) {
      case 'harvest':
        result = await scheduler.triggerHarvest();
        break;
      case 'processing':
        result = await scheduler.triggerProcessing();
        break;
      case 'upload':
        result = await scheduler.triggerUpload();
        break;
      case 'metadata':
        result = await scheduler.executeMetadataRefresh();
        break;
      case 'maintenance':
        result = await scheduler.executeMaintenanceCycle();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid job name'
        });
    }

    // Log the manual trigger
    await AuditLog.create({
      userId: req.user.userId,
      action: `manual_${jobName}_trigger`,
      resource: 'scheduler',
      details: { jobName },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({
      success: true,
      message: `${jobName} job triggered successfully`,
      data: result
    });
  } catch (error) {
    logger.error('Scheduler job trigger error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to trigger job ${req.params.jobName}`
    });
  }
});

// Manual scheduler triggers (legacy endpoint - kept for backward compatibility)
router.post('/scheduler/trigger/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const { scheduler } = require('../services/scheduler');

    let result;
    switch (action) {
      case 'harvest':
        result = await scheduler.triggerHarvest();
        break;
      case 'processing':
        result = await scheduler.triggerProcessing();
        break;
      case 'upload':
        result = await scheduler.triggerUpload();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action'
        });
    }

    // Log the manual trigger
    await AuditLog.create({
      userId: req.user.userId,
      action: `manual_${action}_trigger`,
      resource: 'scheduler',
      details: { action },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({
      success: true,
      message: `${action} triggered successfully`,
      data: result
    });
  } catch (error) {
    logger.error('Scheduler trigger error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to trigger ${req.params.action}`
    });
  }
});

// Historical metrics
router.get('/metrics/history', async (req, res) => {
  try {
    const { hours = 24, period = '5min' } = req.query;
    
    const since = new Date();
    since.setHours(since.getHours() - parseInt(hours));

    const metrics = await SystemMetric.findAll({
      where: {
        timestamp: { [require('sequelize').Op.gte]: since }
      },
      order: [['timestamp', 'ASC']],
      limit: 288 // Max points for 24 hours at 5-minute intervals
    });

    // Group metrics by time period if needed
    const groupedMetrics = groupMetricsByPeriod(metrics, period);

    res.json({
      success: true,
      data: {
        metrics: groupedMetrics,
        period,
        hours: parseInt(hours)
      }
    });
  } catch (error) {
    logger.error('Metrics history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics history'
    });
  }
});

// Audit logs
router.get('/audit', async (req, res) => {
  try {
    const { page = 1, limit = 50, action, success } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (action) where.action = { [require('sequelize').Op.like]: `%${action}%` };
    if (success !== undefined) where.success = success === 'true';

    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

// Asset harvesting endpoints
router.post('/harvest/youtube', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required'
      });
    }

    const AssetHarvester = require('../services/assetHarvester');
    const harvester = new AssetHarvester();
    
    const result = await harvester.harvestFromYouTube(url, options);
    
    // Create asset record in database
    const asset = await Asset.create({
      filename: path.basename(result.filePath),
      originalPath: result.filePath,
      type: 'audio',
      status: 'downloaded',
      source: 'youtube',
      metadata: {
        title: result.title,
        duration: result.duration,
        sourceUrl: result.url
      }
    });

    // Log the action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'harvest_youtube',
      resource: 'asset',
      resourceId: asset.id,
      details: { url, title: result.title },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    res.json({
      success: true,
      message: 'YouTube asset harvested successfully',
      data: { asset, result }
    });
  } catch (error) {
    logger.error('YouTube harvest error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/harvest/url', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const AssetHarvester = require('../services/assetHarvester');
    const harvester = new AssetHarvester();
    
    const result = await harvester.harvestFromURL(url, options);
    
    // Create asset record in database
    const asset = await Asset.create({
      filename: path.basename(result.filePath),
      originalPath: result.filePath,
      type: 'file',
      status: 'downloaded',
      source: 'url',
      metadata: {
        sourceUrl: result.url,
        size: result.size
      }
    });

    res.json({
      success: true,
      message: 'URL asset harvested successfully',
      data: { asset, result }
    });
  } catch (error) {
    logger.error('URL harvest error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Signal morphology endpoints
router.post('/process/morph/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { options = {} } = req.body;
    
    const asset = await Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    const SignalMorphology = require('../services/signalMorphology');
    const processor = new SignalMorphology();
    
    // Create processing job
    const job = await ProcessingJob.create({
      assetId: asset.id,
      type: 'signal_morphology',
      status: 'running',
      options: options
    });

    try {
      const result = await processor.morphAudio(asset.originalPath, options);
      
      // Update asset with processed file
      await asset.update({
        processedPath: result.outputPath,
        status: 'processed',
        processingMetadata: result.options
      });

      // Update job status
      await job.update({
        status: 'completed',
        result: result,
        completedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Audio morphing completed successfully',
        data: { asset, job, result }
      });
    } catch (processError) {
      await job.update({
        status: 'failed',
        error: processError.message,
        completedAt: new Date()
      });
      throw processError;
    }
  } catch (error) {
    logger.error('Signal morphology error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/process/analyze/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    
    const asset = await Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    const SignalMorphology = require('../services/signalMorphology');
    const processor = new SignalMorphology();
    
    const analysis = await processor.analyzeAudio(asset.originalPath);
    
    // Update asset with analysis data
    await asset.update({
      metadata: {
        ...asset.metadata,
        analysis: analysis
      }
    });

    res.json({
      success: true,
      message: 'Audio analysis completed',
      data: analysis
    });
  } catch (error) {
    logger.error('Audio analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Semantic enrichment endpoints
router.post('/process/enrich/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { options = {} } = req.body;
    
    const asset = await Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    const SemanticEnrichment = require('../services/semanticEnrichment');
    const enricher = new SemanticEnrichment();
    
    // Create processing job
    const job = await ProcessingJob.create({
      assetId: asset.id,
      type: 'semantic_enrichment',
      status: 'running',
      options: options
    });

    try {
      const result = await enricher.enrichTextContent(asset.originalPath, options);
      
      // Update asset with enriched content
      await asset.update({
        processedPath: result.outputPath,
        status: 'processed',
        processingMetadata: {
          ...asset.processingMetadata,
          enrichment: result
        }
      });

      // Update job status
      await job.update({
        status: 'completed',
        result: result,
        completedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Semantic enrichment completed successfully',
        data: { asset, job, result }
      });
    } catch (processError) {
      await job.update({
        status: 'failed',
        error: processError.message,
        completedAt: new Date()
      });
      throw processError;
    }
  } catch (error) {
    logger.error('Semantic enrichment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// YouTube upload endpoints
router.post('/upload/youtube/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { metadata = {} } = req.body;
    
    const asset = await Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    const filePath = asset.processedPath || asset.originalPath;

    const YouTubeUploader = require('../services/youtubeUploader');
    const uploader = new YouTubeUploader();
    
    await uploader.initialize();
    
    // Create upload record
    const upload = await Upload.create({
      assetId: asset.id,
      platform: 'youtube',
      status: 'uploading',
      metadata: metadata
    });

    try {
      const result = await uploader.uploadVideo(filePath, metadata);
      
      // Update upload record
      await upload.update({
        status: 'completed',
        externalId: result.videoId,
        externalUrl: result.videoUrl,
        uploadedAt: new Date(),
        result: result
      });

      // Update asset status
      await asset.update({
        status: 'uploaded',
        uploadMetadata: result
      });

      res.json({
        success: true,
        message: 'YouTube upload completed successfully',
        data: { asset, upload, result }
      });
    } catch (uploadError) {
      await upload.update({
        status: 'failed',
        error: uploadError.message,
        uploadedAt: new Date()
      });
      throw uploadError;
    }
  } catch (error) {
    logger.error('YouTube upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/upload/youtube/auth-url', async (req, res) => {
  try {
    const YouTubeUploader = require('../services/youtubeUploader');
    const uploader = new YouTubeUploader();
    
    const { authUrl } = await uploader.getAuthUrl();
    
    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    logger.error('YouTube auth URL error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/upload/youtube/save-token', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    const YouTubeUploader = require('../services/youtubeUploader');
    const uploader = new YouTubeUploader();
    
    await uploader.saveToken(code);
    
    res.json({
      success: true,
      message: 'YouTube token saved successfully'
    });
  } catch (error) {
    logger.error('YouTube token save error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Processing jobs management
router.get('/processing/jobs', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (status) where.status = status;

    const { count, rows: jobs } = await ProcessingJob.findAndCountAll({
      where,
      include: [
        { 
          model: Asset, 
          as: 'asset',
          attributes: ['id', 'filename', 'type', 'status']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Processing jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch processing jobs'
    });
  }
});

// Start new processing job
router.post('/processing/start', async (req, res) => {
  try {
    const { assetId, type, options = {} } = req.body;
    
    if (!assetId || !type) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID and processing type are required'
      });
    }

    const asset = await Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    // Create processing job
    const job = await ProcessingJob.create({
      assetId: assetId,
      type: type,
      status: 'pending',
      progress: 0,
      startedAt: new Date()
    });

    // Log the action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'processing_job_started',
      resource: 'processing',
      details: { 
        jobId: job.id,
        assetId: assetId,
        assetName: asset.filename,
        type: type 
      },
      success: true
    });

    res.json({
      success: true,
      data: { job }
    });
  } catch (error) {
    logger.error('Start processing job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start processing job'
    });
  }
});

// Delete processing job
router.delete('/processing/jobs/:id', async (req, res) => {
  try {
    const jobId = req.params.id;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const job = await ProcessingJob.findByPk(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Processing job not found'
      });
    }

    // Only allow deletion of completed, failed, or cancelled jobs
    if (job.status === 'running' || job.status === 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete running or pending jobs. Please cancel them first.'
      });
    }

    await job.destroy();

    // Log the action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'processing_job_deleted',
      resource: 'processing',
      details: { 
        jobId: jobId,
        status: job.status,
        type: job.type
      },
      success: true
    });

    res.json({
      success: true,
      message: 'Processing job deleted successfully'
    });
  } catch (error) {
    logger.error('Delete processing job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete processing job'
    });
  }
});

// Analytics endpoint
router.get('/analytics', async (req, res) => {
  try {
    // Use mock data in development if available
    if (process.env.NODE_ENV === 'development' && mockAnalytics) {
      const { timeRange, startDate, endDate } = req.query;
      const mockData = mockAnalytics.mockAnalyticsData(timeRange, startDate, endDate);
      return res.json(mockData);
    }

    const { timeRange, startDate, endDate } = req.query;
    
    // Calculate date range
    let fromDate, toDate;
    if (timeRange) {
      const now = new Date();
      switch (timeRange) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      toDate = now;
    } else if (startDate && endDate) {
      fromDate = new Date(startDate);
      toDate = new Date(endDate);
    } else {
      // Default to last 7 days
      const now = new Date();
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      toDate = now;
    }

    // Fetch analytics data
    const [uploads, assets, jobs, metrics] = await Promise.all([
      Upload.findAll({
        where: {
          createdAt: {
            [require('sequelize').Op.between]: [fromDate, toDate]
          }
        },
        order: [['createdAt', 'ASC']]
      }),
      Asset.findAll({
        where: {
          createdAt: {
            [require('sequelize').Op.between]: [fromDate, toDate]
          }
        },
        order: [['createdAt', 'ASC']]
      }),
      ProcessingJob.findAll({
        where: {
          createdAt: {
            [require('sequelize').Op.between]: [fromDate, toDate]
          }
        },
        order: [['createdAt', 'ASC']]
      }),
      SystemMetric.findAll({
        where: {
          timestamp: {
            [require('sequelize').Op.between]: [fromDate, toDate]
          }
        },
        order: [['timestamp', 'ASC']]
      })
    ]);

    // Process data for charts
    const uploadStats = uploads.reduce((acc, upload) => {
      const date = upload.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const processingStats = jobs.reduce((acc, job) => {
      const date = job.createdAt.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = {};
      acc[date][job.status] = (acc[date][job.status] || 0) + 1;
      return acc;
    }, {});

    const storageStats = assets.reduce((acc, asset) => {
      const date = asset.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + (asset.fileSize || 0);
      return acc;
    }, {});

    // Asset type distribution
    const assetTypes = assets.reduce((acc, asset) => {
      const type = asset.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Status distribution
    const statusDistribution = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    // Format data for frontend
    const analyticsData = {
      uploads: Object.entries(uploadStats).map(([date, count]) => ({ date, count })),
      processing: Object.entries(processingStats).map(([date, statuses]) => ({ date, ...statuses })),
      storage: Object.entries(storageStats).map(([date, size]) => ({ date, size })),
      performance: metrics.map(metric => ({
        timestamp: metric.timestamp,
        cpu: metric.cpuPercent,
        memory: metric.memoryPercent,
        disk: metric.diskPercent
      })),
      assetTypes: Object.entries(assetTypes).map(([type, count]) => ({ type, count })),
      statusDistribution: Object.entries(statusDistribution).map(([status, count]) => ({ status, count }))
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    logger.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});

// Helper functions
async function getDashboardStats() {
  const [
    totalAssets,
    assetsDownloaded,
    assetsProcessed,
    assetsUploaded,
    totalUploads,
    recentJobs,
    systemMetrics
  ] = await Promise.all([
    Asset.count(),
    Asset.count({ where: { status: 'downloaded' } }),
    Asset.count({ where: { status: 'processed' } }),
    Asset.count({ where: { status: 'uploaded' } }),
    Upload.count(),
    ProcessingJob.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{ model: Asset, as: 'asset' }]
    }),
    SystemMetric.findOne({
      order: [['timestamp', 'DESC']]
    })
  ]);

  // Calculate storage usage
  const storageStats = await calculateStorageStats();

  return {
    assets: {
      total: totalAssets,
      downloaded: assetsDownloaded,
      processed: assetsProcessed,
      uploaded: assetsUploaded
    },
    uploads: {
      total: totalUploads,
      thisWeek: await Upload.count({
        where: {
          createdAt: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    },
    system: systemMetrics ? {
      cpu: systemMetrics.cpuPercent,
      memory: systemMetrics.memoryPercent,
      disk: systemMetrics.diskPercent,
      processes: systemMetrics.activeProcesses,
      uptime: systemMetrics.uptime
    } : null,
    storage: storageStats,
    recentActivity: recentJobs.map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      assetName: job.asset?.filename || 'Unknown',
      createdAt: job.createdAt
    }))
  };
}

async function calculateStorageStats() {
  const fs = require('fs').promises;
  const path = require('path');

  try {
    const dirs = ['downloads', 'processed', 'uploads'];
    const stats = {};

    for (const dir of dirs) {
      const dirPath = path.join(__dirname, '../../', dir);
      try {
        const files = await fs.readdir(dirPath);
        let totalSize = 0;
        
        for (const file of files) {
          try {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
              totalSize += stat.size;
            }
          } catch (e) {
            // Skip files that can't be accessed
          }
        }

        stats[dir] = {
          fileCount: files.length,
          totalSize: totalSize,
          sizeFormatted: formatBytes(totalSize)
        };
      } catch (e) {
        stats[dir] = { fileCount: 0, totalSize: 0, sizeFormatted: '0 B' };
      }
    }

    return stats;
  } catch (error) {
    logger.error('Storage stats calculation error:', error);
    return {};
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function groupMetricsByPeriod(metrics, period) {
  // For now, just return the metrics as-is
  // In the future, this could group metrics by time periods
  return metrics;
}

function getActivityDescription(activity) {
  const { action, resource, details } = activity;
  
  switch (action) {
    case 'login_success':
      return `User ${details?.username || 'unknown'} logged in successfully`;
    case 'login_failed':
      return `Failed login attempt for ${details?.username || 'unknown'}`;
    case 'logout':
      return `User ${details?.username || 'unknown'} logged out`;
    case 'asset_created':
      return `New asset created: ${details?.filename || 'unknown'}`;
    case 'asset_processed':
      return `Asset processed: ${details?.filename || 'unknown'}`;
    case 'asset_uploaded':
      return `Asset uploaded: ${details?.filename || 'unknown'}`;
    case 'processing_job_started':
      return `Processing job started for ${details?.assetName || 'asset'}`;
    case 'processing_job_completed':
      return `Processing job completed for ${details?.assetName || 'asset'}`;
    case 'system_health_check':
      return 'System health check performed';
    default:
      return `${action.replace(/_/g, ' ')} on ${resource || 'system'}`;
  }
}

// Mock dashboard stats function
function getMockDashboardStats() {
  return {
    assets: {
      total: 45,
      downloaded: 23,
      processed: 18,
      uploaded: 12
    },
    uploads: {
      total: 28,
      thisWeek: 6
    },
    system: {
      cpu: 42.5,
      memory: 67.8,
      disk: 55.2,
      processes: 156,
      uptime: 86400 * 3 // 3 days
    },
    storage: {
      downloads: {
        fileCount: 23,
        totalSize: 1024 * 1024 * 850, // ~850MB
        sizeFormatted: '850 MB'
      },
      processed: {
        fileCount: 18,
        totalSize: 1024 * 1024 * 720, // ~720MB
        sizeFormatted: '720 MB'
      },
      uploads: {
        fileCount: 12,
        totalSize: 1024 * 1024 * 345, // ~345MB
        sizeFormatted: '345 MB'
      }
    },
    recentActivity: [
      {
        id: 1,
        type: 'signal_morphology',
        status: 'completed',
        assetName: 'ambient_track_01.mp3',
        createdAt: new Date(Date.now() - 2 * 3600000) // 2 hours ago
      },
      {
        id: 2,
        type: 'harvest',
        status: 'running',
        assetName: 'podcast_episode_42.mp3',
        createdAt: new Date(Date.now() - 3600000) // 1 hour ago
      },
      {
        id: 3,
        type: 'upload',
        status: 'completed',
        assetName: 'music_loop_synthwave.wav',
        createdAt: new Date(Date.now() - 30 * 60000) // 30 minutes ago
      },
      {
        id: 4,
        type: 'semantic_enrichment',
        status: 'pending',
        assetName: 'voice_recording_demo.mp3',
        createdAt: new Date(Date.now() - 15 * 60000) // 15 minutes ago
      },
      {
        id: 5,
        type: 'signal_morphology',
        status: 'failed',
        assetName: 'corrupted_file.mp3',
        createdAt: new Date(Date.now() - 10 * 60000) // 10 minutes ago
      }
    ]
  };
}

// Mock metrics history function
function getMockMetricsHistory(limit = 50) {
  const now = new Date();
  const metrics = [];
  
  for (let i = limit - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 5 * 60000)); // 5-minute intervals
    metrics.push({
      timestamp: timestamp.toISOString(),
      cpuPercent: Math.random() * 30 + 35, // 35-65% CPU usage
      memoryPercent: Math.random() * 20 + 60, // 60-80% memory usage
      diskPercent: Math.random() * 10 + 50, // 50-60% disk usage
      networkBytesIn: Math.floor(Math.random() * 1000000), // Random network bytes
      networkBytesOut: Math.floor(Math.random() * 500000)
    });
  }
  
  return metrics;
}

module.exports = router;
