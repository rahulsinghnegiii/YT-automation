const si = require('systeminformation');
const logger = require('../utils/logger');
const { SystemMetric } = require('../models');

class SystemMonitor {
  constructor(io) {
    this.io = io;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.metrics = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: { rx: 0, tx: 0 },
      processes: 0,
      uptime: 0
    };
  }

  async startMonitoring() {
    if (this.isMonitoring) return;

    try {
      logger.info('📊 Starting real-time system monitoring...');
      this.isMonitoring = true;

      // Update metrics every 5 seconds
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.updateMetrics();
          this.broadcastMetrics();
        } catch (error) {
          logger.error('❌ Failed to update system metrics:', error);
        }
      }, 5000);

      // Save metrics to database every minute
      setInterval(async () => {
        try {
          await this.saveMetrics();
        } catch (error) {
          logger.error('❌ Failed to save system metrics:', error);
        }
      }, 60000);

      logger.info('✅ System monitoring started');
    } catch (error) {
      logger.error('❌ Monitoring initialization failed:', error);
      throw error;
    }
  }

  async stopMonitoring() {
    if (!this.isMonitoring) return;

    logger.info('🛑 Stopping system monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('✅ System monitoring stopped');
  }

  async updateMetrics() {
    try {
      // Get CPU usage
      const cpuData = await si.currentLoad();
      this.metrics.cpu = cpuData.currentLoad;

      // Get memory usage
      const memData = await si.mem();
      this.metrics.memory = (memData.used / memData.total) * 100;

      // Get disk usage
      const diskData = await si.fsSize();
      if (diskData.length > 0) {
        this.metrics.disk = diskData[0].use;
      }

      // Get network stats
      const networkData = await si.networkStats();
      if (networkData.length > 0) {
        this.metrics.network = {
          rx: networkData[0].rx_bytes,
          tx: networkData[0].tx_bytes
        };
      }

      // Get process count
      const processData = await si.processes();
      this.metrics.processes = processData.list ? processData.list.length : 0;

      // Get system uptime
      const uptimeData = await si.time();
      this.metrics.uptime = uptimeData.uptime;

    } catch (error) {
      logger.error('❌ Error updating metrics:', error);
    }
  }

  async saveMetrics() {
    try {
      await SystemMetric.create({
        cpuPercent: this.metrics.cpu,
        memoryPercent: this.metrics.memory,
        diskPercent: this.metrics.disk,
        networkBytesIn: this.metrics.network.rx,
        networkBytesOut: this.metrics.network.tx,
        activeProcesses: this.metrics.processes,
        uptime: this.metrics.uptime
      });
    } catch (error) {
      logger.error('❌ Failed to save metrics to database:', error);
    }
  }

  broadcastMetrics() {
    if (this.io) {
      this.io.emit('system-metrics', {
        timestamp: new Date().toISOString(),
        metrics: this.metrics
      });
    }
  }

  async getSystemInfo() {
    try {
      const [cpu, mem, os, disk] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.osInfo(),
        si.fsSize()
      ]);

      return {
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          speed: cpu.speed
        },
        memory: {
          total: mem.total,
          free: mem.free,
          used: mem.used,
          available: mem.available
        },
        os: {
          platform: os.platform,
          distro: os.distro,
          release: os.release,
          arch: os.arch,
          hostname: os.hostname
        },
        disk: disk.map(d => ({
          fs: d.fs,
          type: d.type,
          size: d.size,
          used: d.used,
          available: d.available,
          use: d.use,
          mount: d.mount
        }))
      };
    } catch (error) {
      logger.error('❌ Failed to get system info:', error);
      return {};
    }
  }

  async getHistoricalMetrics(hours = 24) {
    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      const metrics = await SystemMetric.findAll({
        where: {
          timestamp: { [require('sequelize').Op.gte]: since }
        },
        order: [['timestamp', 'ASC']],
        limit: 288 // Max 5-minute intervals for 24 hours
      });

      return metrics.map(m => ({
        timestamp: m.timestamp,
        cpu: m.cpuPercent,
        memory: m.memoryPercent,
        disk: m.diskPercent,
        processes: m.activeProcesses
      }));
    } catch (error) {
      logger.error('❌ Failed to get historical metrics:', error);
      return [];
    }
  }

  getCurrentMetrics() {
    return {
      timestamp: new Date().toISOString(),
      ...this.metrics
    };
  }

  async getServiceStatus() {
    // Check status of various services
    return {
      database: await this.checkDatabaseHealth(),
      storage: await this.checkStorageHealth(),
      network: await this.checkNetworkHealth(),
      scheduler: this.checkSchedulerHealth()
    };
  }

  async checkDatabaseHealth() {
    try {
      const { sequelize } = require('../models');
      await sequelize.authenticate();
      return { status: 'healthy', message: 'Database connection OK' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  async checkStorageHealth() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const dirs = ['downloads', 'processed', 'uploads', 'temp'];
      const checks = await Promise.all(
        dirs.map(async (dir) => {
          const dirPath = path.join(__dirname, '../../', dir);
          try {
            await fs.access(dirPath);
            return { [dir]: 'accessible' };
          } catch {
            return { [dir]: 'inaccessible' };
          }
        })
      );

      return { 
        status: 'healthy', 
        directories: Object.assign({}, ...checks) 
      };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  async checkNetworkHealth() {
    try {
      const axios = require('axios');
      const start = Date.now();
      await axios.get('https://www.google.com', { timeout: 5000 });
      const responseTime = Date.now() - start;
      
      return { 
        status: 'healthy', 
        responseTime: `${responseTime}ms`,
        message: 'Internet connectivity OK' 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: 'No internet connectivity' 
      };
    }
  }

  checkSchedulerHealth() {
    const { scheduler } = require('./scheduler');
    const jobsStatus = scheduler.getAllJobsStatus();
    const healthyJobs = Object.values(jobsStatus).filter(job => job.running).length;
    const totalJobs = Object.keys(jobsStatus).length;
    
    return {
      status: healthyJobs === totalJobs ? 'healthy' : 'partial',
      message: `${healthyJobs}/${totalJobs} jobs running`,
      jobs: jobsStatus
    };
  }
}

// Initialize monitoring
async function initializeRealTimeMonitoring(io) {
  const monitor = new SystemMonitor(io);
  await monitor.startMonitoring();
  
  // Handle WebSocket connections
  io.on('connection', (socket) => {
    logger.info(`📡 Client connected: ${socket.id}`);
    
    // Send current metrics immediately
    socket.emit('system-metrics', {
      timestamp: new Date().toISOString(),
      metrics: monitor.getCurrentMetrics()
    });

    socket.on('request-system-info', async () => {
      const systemInfo = await monitor.getSystemInfo();
      socket.emit('system-info', systemInfo);
    });

    socket.on('request-historical-metrics', async (data) => {
      const hours = data?.hours || 24;
      const metrics = await monitor.getHistoricalMetrics(hours);
      socket.emit('historical-metrics', metrics);
    });

    socket.on('disconnect', () => {
      logger.info(`📡 Client disconnected: ${socket.id}`);
    });
  });

  return monitor;
}

module.exports = { SystemMonitor, initializeRealTimeMonitoring };
