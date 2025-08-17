// Mock data for /api/scheduler/* endpoints

const mockSchedulerJobs = [
  {
    name: 'harvest',
    running: true,
    lastRun: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    nextRun: new Date(Date.now() + 4 * 3600000).toISOString(), // 4 hours from now
    schedule: '0 */6 * * *', // Every 6 hours
    description: 'Harvest content from configured sources',
    executionCount: 24,
    successCount: 22,
    failureCount: 2,
    averageDuration: 450, // seconds
    status: 'healthy'
  },
  {
    name: 'processing',
    running: true,
    lastRun: new Date(Date.now() - 0.5 * 3600000).toISOString(), // 30 minutes ago
    nextRun: new Date(Date.now() + 1.5 * 3600000).toISOString(), // 1.5 hours from now
    schedule: '0 */2 * * *', // Every 2 hours
    description: 'Process uploaded assets through morphology and enrichment',
    executionCount: 72,
    successCount: 68,
    failureCount: 4,
    averageDuration: 120, // seconds
    status: 'healthy'
  },
  {
    name: 'upload',
    running: false,
    lastRun: new Date(Date.now() - 6 * 3600000).toISOString(), // 6 hours ago
    nextRun: new Date(Date.now() + 2 * 3600000).toISOString(), // 2 hours from now
    schedule: '0 */8 * * *', // Every 8 hours
    description: 'Upload processed content to YouTube and other platforms',
    executionCount: 18,
    successCount: 15,
    failureCount: 3,
    averageDuration: 300, // seconds
    status: 'stopped'
  },
  {
    name: 'metadata',
    running: true,
    lastRun: new Date(Date.now() - 24 * 3600000).toISOString(), // 1 day ago
    nextRun: new Date(Date.now() + 6 * 24 * 3600000).toISOString(), // 6 days from now
    schedule: '0 2 */7 * *', // Weekly at 2 AM
    description: 'Refresh metadata for existing uploads',
    executionCount: 4,
    successCount: 4,
    failureCount: 0,
    averageDuration: 180, // seconds
    status: 'healthy'
  },
  {
    name: 'maintenance',
    running: true,
    lastRun: new Date(Date.now() - 12 * 3600000).toISOString(), // 12 hours ago
    nextRun: new Date(Date.now() + 12 * 3600000).toISOString(), // 12 hours from now
    schedule: '0 3 * * *', // Daily at 3 AM
    description: 'System cleanup and maintenance tasks',
    executionCount: 30,
    successCount: 30,
    failureCount: 0,
    averageDuration: 60, // seconds
    status: 'healthy'
  }
];

const mockSchedulerStatus = {
  success: true,
  data: mockSchedulerJobs
};

const mockSchedulerConfig = {
  success: true,
  data: {
    harvestInterval: 6,
    processingInterval: 2,
    uploadInterval: 8,
    metadataRefreshDays: 7,
    maintenanceTime: '03:00',
    timezone: 'UTC',
    maxConcurrentJobs: 3,
    retryAttempts: 3,
    retryDelay: 300,
    enabled: true,
    notifications: {
      email: true,
      webhook: false,
      slack: false
    },
    quotaLimits: {
      dailyUploads: 100,
      dailyDownloads: 500,
      monthlyApiCalls: 50000
    },
    resourceLimits: {
      maxCpuUsage: 80,
      maxMemoryUsage: 75,
      maxDiskUsage: 90
    }
  }
};

const mockJobTriggerResponse = (jobName) => ({
  success: true,
  message: `${jobName} job triggered successfully`,
  data: {
    jobName,
    triggeredAt: new Date().toISOString(),
    estimatedDuration: Math.floor(Math.random() * 300) + 60, // 1-5 minutes
    jobId: `job_${Date.now()}`,
    status: 'queued'
  }
});

const mockJobControlResponse = (jobName, action) => ({
  success: true,
  message: `Job ${jobName} ${action}ed successfully`,
  data: {
    jobName,
    action,
    timestamp: new Date().toISOString(),
    previousState: action === 'start' ? 'stopped' : 'running',
    newState: action === 'start' ? 'running' : 'stopped'
  }
});

const mockConfigUpdateResponse = (newConfig) => ({
  success: true,
  message: 'Scheduler configuration updated successfully',
  data: {
    ...mockSchedulerConfig.data,
    ...newConfig,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'admin'
  }
});

// Simulate scheduler service methods
const mockSchedulerService = {
  isInitialized: true,
  
  getAllJobsStatus: () => mockSchedulerJobs,
  
  getConfig: () => mockSchedulerConfig.data,
  
  updateConfig: async (newConfig) => {
    // Simulate config validation and update
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockConfigUpdateResponse(newConfig).data;
  },
  
  startJob: (jobName) => {
    const job = mockSchedulerJobs.find(j => j.name === jobName);
    if (job) {
      job.running = true;
      job.status = 'healthy';
      return true;
    }
    return false;
  },
  
  stopJob: (jobName) => {
    const job = mockSchedulerJobs.find(j => j.name === jobName);
    if (job) {
      job.running = false;
      job.status = 'stopped';
      return true;
    }
    return false;
  },
  
  triggerHarvest: async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockJobTriggerResponse('harvest').data;
  },
  
  triggerProcessing: async () => {
    await new Promise(resolve => setTimeout(resolve, 150));
    return mockJobTriggerResponse('processing').data;
  },
  
  triggerUpload: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockJobTriggerResponse('upload').data;
  },
  
  executeMetadataRefresh: async () => {
    await new Promise(resolve => setTimeout(resolve, 180));
    return mockJobTriggerResponse('metadata').data;
  },
  
  executeMaintenanceCycle: async () => {
    await new Promise(resolve => setTimeout(resolve, 120));
    return mockJobTriggerResponse('maintenance').data;
  }
};

module.exports = {
  mockSchedulerJobs,
  mockSchedulerStatus,
  mockSchedulerConfig,
  mockJobTriggerResponse,
  mockJobControlResponse,
  mockConfigUpdateResponse,
  mockSchedulerService
};
