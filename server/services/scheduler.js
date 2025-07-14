const cron = require('node-cron');
const logger = require('../utils/logger');
const { Asset, ProcessingJob } = require('../models');
const AssetHarvester = require('./assetHarvester');
const SemanticEnrichment = require('./semanticEnrichment');
const SignalMorphology = require('./signalMorphology');
const YouTubeUploader = require('./youtubeUploader');

class TaskScheduler {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      logger.info('🕐 Initializing Task Scheduler...');

      // Phase V: Temporal Logic & Relay Sequencing
      await this.setupScheduledTasks();
      
      this.isInitialized = true;
      logger.info('✅ Task Scheduler initialized successfully');
    } catch (error) {
      logger.error('❌ Scheduler initialization failed:', error);
      throw error;
    }
  }

  async setupScheduledTasks() {
    // Asset harvesting every X hours
    const harvestInterval = process.env.HARVEST_INTERVAL_HOURS || 6;
    const harvestJob = cron.schedule(`0 */${harvestInterval} * * *`, async () => {
      logger.info('🔄 Starting scheduled asset harvest...');
      try {
        await this.executeHarvestCycle();
        logger.info('✅ Scheduled asset harvest completed');
      } catch (error) {
        logger.error('❌ Scheduled asset harvest failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    // Processing every 2 hours
    const processingInterval = process.env.PROCESSING_INTERVAL_HOURS || 2;
    const processingJob = cron.schedule(`0 */${processingInterval} * * *`, async () => {
      logger.info('🔄 Starting scheduled processing cycle...');
      try {
        await this.executeProcessingCycle();
        logger.info('✅ Scheduled processing cycle completed');
      } catch (error) {
        logger.error('❌ Scheduled processing cycle failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    // Upload cycle every 8 hours
    const uploadInterval = process.env.UPLOAD_INTERVAL_HOURS || 8;
    const uploadJob = cron.schedule(`0 */${uploadInterval} * * *`, async () => {
      logger.info('🔄 Starting scheduled upload cycle...');
      try {
        await this.executeUploadCycle();
        logger.info('✅ Scheduled upload cycle completed');
      } catch (error) {
        logger.error('❌ Scheduled upload cycle failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    // Metadata refresh every 30 days
    const metadataRefreshDays = process.env.METADATA_REFRESH_DAYS || 30;
    const metadataJob = cron.schedule(`0 2 */${metadataRefreshDays} * *`, async () => {
      logger.info('🔄 Starting scheduled metadata refresh...');
      try {
        await this.executeMetadataRefresh();
        logger.info('✅ Scheduled metadata refresh completed');
      } catch (error) {
        logger.error('❌ Scheduled metadata refresh failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    // System maintenance daily at 3 AM
    const maintenanceJob = cron.schedule('0 3 * * *', async () => {
      logger.info('🔄 Starting scheduled maintenance...');
      try {
        await this.executeMaintenanceCycle();
        logger.info('✅ Scheduled maintenance completed');
      } catch (error) {
        logger.error('❌ Scheduled maintenance failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    // Store jobs for management
    this.jobs.set('harvest', harvestJob);
    this.jobs.set('processing', processingJob);
    this.jobs.set('upload', uploadJob);
    this.jobs.set('metadata', metadataJob);
    this.jobs.set('maintenance', maintenanceJob);

    // Start all jobs
    this.startAllJobs();
  }

  startAllJobs() {
    logger.info('▶️ Starting all scheduled tasks...');
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`✅ Started ${name} scheduler`);
    });
  }

  stopAllJobs() {
    logger.info('⏹️ Stopping all scheduled tasks...');
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`🛑 Stopped ${name} scheduler`);
    });
  }

  async executeHarvestCycle() {
    const harvester = new AssetHarvester();
    
    // Create processing job
    const job = await ProcessingJob.create({
      type: 'download',
      status: 'running',
      startedAt: new Date()
    });

    try {
      await harvester.harvestFromSources();
      
      await job.update({
        status: 'completed',
        completedAt: new Date(),
        result: { message: 'Harvest cycle completed successfully' }
      });

      logger.logSystem('harvest_cycle_completed', {
        jobId: job.id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await job.update({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message
      });
      throw error;
    }
  }

  async executeProcessingCycle() {
    const morphology = new SignalMorphology();
    const semantic = new SemanticEnrichment();

    // Find assets that need processing
    const assetsToProcess = await Asset.findAll({
      where: { status: 'downloaded' },
      limit: 10
    });

    for (const asset of assetsToProcess) {
      try {
        // Signal morphology processing
        await morphology.processAsset(asset);
        
        // Semantic enrichment
        await semantic.enrichAsset(asset);
        
        await asset.update({ status: 'processed' });
        
        logger.info(`✅ Processed asset: ${asset.filename}`);
      } catch (error) {
        logger.error(`❌ Failed to process asset ${asset.filename}:`, error);
        await asset.update({ 
          status: 'failed',
          errorMessage: error.message 
        });
      }
    }
  }

  async executeUploadCycle() {
    const uploader = new YouTubeUploader();

    // Find processed assets ready for upload
    const assetsToUpload = await Asset.findAll({
      where: { status: 'processed' },
      limit: 5 // Respect rate limits
    });

    for (const asset of assetsToUpload) {
      try {
        await uploader.uploadAsset(asset);
        await asset.update({ status: 'uploaded' });
        
        logger.info(`✅ Uploaded asset: ${asset.filename}`);
      } catch (error) {
        logger.error(`❌ Failed to upload asset ${asset.filename}:`, error);
        await asset.update({ 
          status: 'failed',
          errorMessage: error.message 
        });
      }
    }
  }

  async executeMetadataRefresh() {
    const semantic = new SemanticEnrichment();
    
    // Find uploaded assets older than refresh period
    const refreshDate = new Date();
    refreshDate.setDate(refreshDate.getDate() - (process.env.METADATA_REFRESH_DAYS || 30));

    const assetsToRefresh = await Asset.findAll({
      where: { 
        status: 'uploaded',
        updatedAt: { [require('sequelize').Op.lt]: refreshDate }
      },
      limit: 20
    });

    for (const asset of assetsToRefresh) {
      try {
        await semantic.refreshMetadata(asset);
        logger.info(`✅ Refreshed metadata for: ${asset.filename}`);
      } catch (error) {
        logger.error(`❌ Failed to refresh metadata for ${asset.filename}:`, error);
      }
    }
  }

  async executeMaintenanceCycle() {
    logger.info('🧹 Starting system maintenance...');

    // Clean up old processing jobs
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - 7);

    await ProcessingJob.destroy({
      where: {
        status: 'completed',
        completedAt: { [require('sequelize').Op.lt]: cleanupDate }
      }
    });

    // Clean up temporary files
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const tempDir = path.join(__dirname, '../../temp');
      const files = await fs.readdir(tempDir);
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        // Delete files older than 24 hours
        if (Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
          await fs.unlink(filePath);
          logger.info(`🗑️ Cleaned up temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('❌ Maintenance cleanup failed:', error);
    }

    logger.info('✅ System maintenance completed');
  }

  // Manual trigger methods
  async triggerHarvest() {
    logger.info('🔧 Manual harvest triggered');
    return this.executeHarvestCycle();
  }

  async triggerProcessing() {
    logger.info('🔧 Manual processing triggered');
    return this.executeProcessingCycle();
  }

  async triggerUpload() {
    logger.info('🔧 Manual upload triggered');
    return this.executeUploadCycle();
  }

  // Individual job control methods
  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`✅ Started ${jobName} scheduler`);
      return true;
    }
    return false;
  }

  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`🛑 Stopped ${jobName} scheduler`);
      return true;
    }
    return false;
  }

  // Configuration methods
  getConfig() {
    return {
      harvestInterval: parseInt(process.env.HARVEST_INTERVAL_HOURS || 6),
      processingInterval: parseInt(process.env.PROCESSING_INTERVAL_HOURS || 2),
      uploadInterval: parseInt(process.env.UPLOAD_INTERVAL_HOURS || 8),
      metadataRefreshDays: parseInt(process.env.METADATA_REFRESH_DAYS || 30),
    };
  }

  async updateConfig(newConfig) {
    // Update environment variables (in production, this would update a config file)
    process.env.HARVEST_INTERVAL_HOURS = newConfig.harvestInterval?.toString() || process.env.HARVEST_INTERVAL_HOURS;
    process.env.PROCESSING_INTERVAL_HOURS = newConfig.processingInterval?.toString() || process.env.PROCESSING_INTERVAL_HOURS;
    process.env.UPLOAD_INTERVAL_HOURS = newConfig.uploadInterval?.toString() || process.env.UPLOAD_INTERVAL_HOURS;
    process.env.METADATA_REFRESH_DAYS = newConfig.metadataRefreshDays?.toString() || process.env.METADATA_REFRESH_DAYS;

    // Restart jobs with new intervals
    this.stopAllJobs();
    this.jobs.clear();
    await this.setupScheduledTasks();
    
    logger.info('✅ Scheduler configuration updated');
    return this.getConfig();
  }

  getJobSchedule(jobName) {
    const schedules = {
      'harvest': `0 */${process.env.HARVEST_INTERVAL_HOURS || 6} * * *`,
      'processing': `0 */${process.env.PROCESSING_INTERVAL_HOURS || 2} * * *`,
      'upload': `0 */${process.env.UPLOAD_INTERVAL_HOURS || 8} * * *`,
      'metadata': `0 2 */${process.env.METADATA_REFRESH_DAYS || 30} * *`,
      'maintenance': '0 3 * * *',
    };
    return schedules[jobName] || 'Unknown';
  }

  // Status methods
  getJobStatus(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) return null;

    // Get schedule expression for the job
    const schedule = this.getJobSchedule(jobName);
    
    // For cron jobs, we need to manually track last run and calculate next run
    // node-cron doesn't provide these directly in all versions
    let lastRun = null;
    let nextRun = null;

    try {
      // Try to get the last and next dates if available
      if (job.lastDate) {
        lastRun = job.lastDate();
      }
      if (job.nextDate) {
        nextRun = job.nextDate();
      }
    } catch (error) {
      // Fallback for older versions of node-cron
      logger.debug(`Could not get cron dates for ${jobName}:`, error.message);
    }

    return {
      name: jobName,
      running: job.running || false,
      lastRun: lastRun,
      nextRun: nextRun,
      schedule: schedule
    };
  }

  getAllJobsStatus() {
    const jobs = [];
    this.jobs.forEach((job, name) => {
      jobs.push(this.getJobStatus(name));
    });
    return jobs;
  }
}

// Export singleton instance
const scheduler = new TaskScheduler();

async function initializeScheduler() {
  await scheduler.initialize();
  return scheduler;
}

module.exports = { TaskScheduler, initializeScheduler, scheduler };
