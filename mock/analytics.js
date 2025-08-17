// Mock data for /api/analytics endpoints

// Helper function to generate time series data
const generateTimeSeriesData = (days, baseValue, variance = 0.3) => {
  const data = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const value = Math.max(0, Math.floor(baseValue * (1 + (Math.random() - 0.5) * variance)));
    data.push({
      date: date.toISOString().split('T')[0],
      value: value
    });
  }
  
  return data;
};

// Helper function to generate hourly metrics
const generateHourlyMetrics = (hours) => {
  const data = [];
  const now = new Date();
  
  for (let i = hours - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      timestamp: timestamp.toISOString(),
      cpu: 20 + Math.random() * 60,
      memory: 40 + Math.random() * 40,
      disk: 30 + Math.random() * 30,
      activeJobs: Math.floor(Math.random() * 5)
    });
  }
  
  return data;
};

const mockAnalyticsData = (timeRange = '7d', startDate = null, endDate = null) => {
  let days = 7;
  
  // Determine time range
  if (timeRange) {
    switch (timeRange) {
      case '1d': days = 1; break;
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      default: days = 7;
    }
  } else if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }

  // Generate upload activity data
  const uploads = generateTimeSeriesData(days, 5, 0.5).map(item => ({
    date: item.date,
    count: item.value
  }));

  // Generate processing performance data
  const processing = generateTimeSeriesData(days, 8, 0.4).map((item, index) => ({
    date: item.date,
    completed: item.value,
    failed: Math.floor(item.value * 0.1),
    avgDuration: 120 + Math.random() * 180,
    successRate: 85 + Math.random() * 10
  }));

  // Generate storage usage data
  const storage = generateTimeSeriesData(days, 1024 * 1024 * 100, 0.2).map(item => ({
    date: item.date,
    used: item.value,
    size: item.value
  }));

  // Generate system performance metrics
  const performance = generateHourlyMetrics(Math.min(days * 24, 168)); // Max 1 week of hourly data

  // Asset type distribution
  const assetTypes = [
    { type: 'audio', count: 25, value: 25 },
    { type: 'video', count: 8, value: 8 },
    { type: 'podcast', count: 12, value: 12 },
    { type: 'music', count: 18, value: 18 },
    { type: 'voice', count: 6, value: 6 }
  ];

  // Job status distribution
  const statusDistribution = [
    { status: 'completed', count: 45 },
    { status: 'running', count: 3 },
    { status: 'pending', count: 8 },
    { status: 'failed', count: 6 }
  ];

  return {
    success: true,
    data: {
      uploads,
      processing,
      storage,
      performance,
      assetTypes,
      statusDistribution,
      summary: {
        totalAssets: assetTypes.reduce((sum, type) => sum + type.count, 0),
        totalUploads: uploads.reduce((sum, day) => sum + day.count, 0),
        averageProcessingTime: 156.7,
        successRate: 89.2,
        totalStorageUsed: storage[storage.length - 1]?.size || 0,
        activeJobs: 3,
        systemHealth: {
          overall: 'healthy',
          cpu: 42.3,
          memory: 68.5,
          disk: 55.2
        }
      },
      trends: {
        uploadsGrowth: '+12.5%',
        processingEfficiency: '+8.3%',
        storageGrowth: '+15.2%',
        errorRate: '-23.1%'
      }
    }
  };
};

// Additional mock data for detailed analytics
const mockDetailedAnalytics = {
  success: true,
  data: {
    platformMetrics: {
      youtube: {
        uploads: 38,
        views: 125420,
        likes: 8934,
        comments: 1245,
        subscribers: 892,
        revenue: 234.67
      },
      spotify: {
        uploads: 15,
        streams: 45678,
        followers: 234,
        playlists: 12
      },
      soundcloud: {
        uploads: 8,
        plays: 12340,
        likes: 456,
        reposts: 67
      }
    },
    contentMetrics: {
      genres: [
        { name: 'Electronic', count: 18, percentage: 35.3 },
        { name: 'Ambient', count: 12, percentage: 23.5 },
        { name: 'Classical', count: 8, percentage: 15.7 },
        { name: 'Rock', count: 6, percentage: 11.8 },
        { name: 'Jazz', count: 4, percentage: 7.8 },
        { name: 'Other', count: 3, percentage: 5.9 }
      ],
      durations: [
        { range: '0-2 min', count: 15 },
        { range: '2-5 min', count: 22 },
        { range: '5-10 min', count: 18 },
        { range: '10-30 min', count: 8 },
        { range: '30+ min', count: 5 }
      ],
      quality: [
        { bitrate: '320kbps', count: 28 },
        { bitrate: '256kbps', count: 15 },
        { bitrate: '192kbps', count: 12 },
        { bitrate: '128kbps', count: 8 }
      ]
    },
    processingMetrics: {
      morphologyStats: {
        effectsUsed: {
          reverb: 45,
          compression: 38,
          eq: 52,
          noise_reduction: 23,
          stereo_widening: 19
        },
        averageProcessingTime: 145.7,
        cpuUsage: 67.3,
        memoryUsage: 45.2
      },
      enrichmentStats: {
        transcriptionsGenerated: 18,
        metadataEnhanced: 41,
        tagsAdded: 156,
        averageConfidence: 0.87
      }
    },
    errorAnalysis: {
      commonErrors: [
        { error: 'Unsupported format', count: 8, percentage: 34.8 },
        { error: 'Network timeout', count: 5, percentage: 21.7 },
        { error: 'Quota exceeded', count: 4, percentage: 17.4 },
        { error: 'File too large', count: 3, percentage: 13.0 },
        { error: 'Processing failed', count: 3, percentage: 13.0 }
      ],
      errorTrends: generateTimeSeriesData(30, 2, 0.8).map(item => ({
        date: item.date,
        errors: item.value
      }))
    }
  }
};

// Mock metrics history data
const mockMetricsHistory = (hours = 24, period = '5min') => {
  const data = [];
  const now = new Date();
  const intervalMinutes = period === '1min' ? 1 : period === '5min' ? 5 : 15;
  const totalPoints = Math.floor((hours * 60) / intervalMinutes);
  
  for (let i = totalPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
    data.push({
      timestamp: timestamp.toISOString(),
      cpuPercent: 20 + Math.random() * 60,
      memoryPercent: 40 + Math.random() * 40,
      diskPercent: 30 + Math.random() * 30,
      networkBytesIn: Math.floor(Math.random() * 1000000),
      networkBytesOut: Math.floor(Math.random() * 800000),
      activeProcesses: 150 + Math.floor(Math.random() * 50),
      uptime: Math.floor(Date.now() / 1000) - i * intervalMinutes * 60
    });
  }
  
  return {
    success: true,
    data: {
      metrics: data,
      period,
      hours: parseInt(hours)
    }
  };
};

// Mock recent activity data
const mockRecentActivity = (limit = 20) => {
  const activities = [
    {
      id: 1,
      type: 'login_success',
      description: 'User admin logged in successfully',
      status: 'success',
      timestamp: new Date(Date.now() - 30 * 60000),
      user: 'admin'
    },
    {
      id: 2,
      type: 'asset_created',
      description: 'New asset created: epic_music_track.mp3',
      status: 'success',
      timestamp: new Date(Date.now() - 1 * 3600000),
      user: 'admin'
    },
    {
      id: 3,
      type: 'processing_job_started',
      description: 'Processing job started for ambient_soundscape.wav',
      status: 'success',
      timestamp: new Date(Date.now() - 1.5 * 3600000),
      user: 'system'
    },
    {
      id: 4,
      type: 'processing_job_completed',
      description: 'Processing job completed for podcast_episode_01.mp3',
      status: 'success',
      timestamp: new Date(Date.now() - 2 * 3600000),
      user: 'system'
    },
    {
      id: 5,
      type: 'asset_uploaded',
      description: 'Asset uploaded: classical_piano.mp3',
      status: 'success',
      timestamp: new Date(Date.now() - 3 * 3600000),
      user: 'admin'
    },
    {
      id: 6,
      type: 'processing_job_failed',
      description: 'Processing failed for game_music_loop.ogg',
      status: 'error',
      timestamp: new Date(Date.now() - 4 * 3600000),
      user: 'system'
    },
    {
      id: 7,
      type: 'scheduler_config_update',
      description: 'Scheduler configuration updated',
      status: 'success',
      timestamp: new Date(Date.now() - 6 * 3600000),
      user: 'admin'
    },
    {
      id: 8,
      type: 'manual_harvest_trigger',
      description: 'Manual harvest job triggered',
      status: 'success',
      timestamp: new Date(Date.now() - 8 * 3600000),
      user: 'admin'
    }
  ];
  
  return {
    success: true,
    data: activities.slice(0, limit)
  };
};

module.exports = {
  mockAnalyticsData,
  mockDetailedAnalytics,
  mockMetricsHistory,
  mockRecentActivity,
  generateTimeSeriesData,
  generateHourlyMetrics
};
