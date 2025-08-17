const { Asset, Upload, ProcessingJob, SystemMetric, AuditLog } = require('../models');
const logger = require('./logger');

async function seedTestData() {
  try {
    logger.info('🌱 Seeding test data...');

    // Create some sample assets if none exist
    const assetCount = await Asset.count();
    if (assetCount === 0) {
      await Asset.bulkCreate([
        {
          filename: 'sample_audio.mp3',
          originalPath: '/uploads/sample_audio.mp3',
          type: 'audio',
          status: 'downloaded',
          source: 'youtube',
          metadata: {
            title: 'Sample Audio Track',
            duration: 180,
            sourceUrl: 'https://youtube.com/watch?v=sample'
          },
          fileSize: 5242880 // 5MB
        },
        {
          filename: 'test_video.mp4',
          originalPath: '/uploads/test_video.mp4',
          type: 'video',
          status: 'processed',
          source: 'url',
          metadata: {
            title: 'Test Video',
            duration: 240,
            sourceUrl: 'https://example.com/video.mp4'
          },
          fileSize: 15728640 // 15MB
        },
        {
          filename: 'music_track.wav',
          originalPath: '/uploads/music_track.wav',
          type: 'audio',
          status: 'uploaded',
          source: 'youtube',
          metadata: {
            title: 'Music Track',
            duration: 200,
            sourceUrl: 'https://youtube.com/watch?v=music'
          },
          fileSize: 20971520 // 20MB
        }
      ]);
      logger.info('✅ Created sample assets');
    }

    // Create sample processing jobs
    const jobCount = await ProcessingJob.count();
    if (jobCount === 0) {
      const assets = await Asset.findAll({ limit: 3 });
      
      for (let i = 0; i < assets.length; i++) {
        await ProcessingJob.create({
          assetId: assets[i].id,
          type: i === 0 ? 'signal_morphology' : i === 1 ? 'semantic_enrichment' : 'download',
          status: i === 0 ? 'completed' : i === 1 ? 'running' : 'failed',
          progress: i === 0 ? 100 : i === 1 ? 65 : 0,
          startedAt: new Date(Date.now() - (i + 1) * 3600000), // Hours ago
          completedAt: i === 0 ? new Date(Date.now() - i * 1800000) : null, // 30 min ago for completed
          result: i === 0 ? { outputPath: '/processed/sample_audio_processed.mp3' } : null,
          errorMessage: i === 2 ? 'Processing failed due to invalid file format' : null
        });
      }
      logger.info('✅ Created sample processing jobs');
    }

    // Create sample uploads
    const uploadCount = await Upload.count();
    if (uploadCount === 0) {
      const uploadedAsset = await Asset.findOne({ where: { status: 'uploaded' } });
      if (uploadedAsset) {
        await Upload.create({
          assetId: uploadedAsset.id,
          platform: 'youtube',
          status: 'completed',
          externalId: 'dQw4w9WgXcQ',
          externalUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
          uploadedAt: new Date(Date.now() - 7200000), // 2 hours ago
          metadata: {
            title: 'Uploaded Music Track',
            description: 'Sample uploaded content',
            tags: ['music', 'sample', 'test']
          },
          result: {
            videoId: 'dQw4w9WgXcQ',
            videoUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
            uploadedAt: new Date(Date.now() - 7200000)
          }
        });
        logger.info('✅ Created sample upload');
      }
    }

    // Create sample system metrics
    const metricsCount = await SystemMetric.count();
    if (metricsCount === 0) {
      const now = new Date();
      const metrics = [];
      
      // Create metrics for the last 24 hours (every 5 minutes = 288 entries)
      for (let i = 0; i < 288; i++) {
        const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // 5 minutes intervals
        metrics.push({
          timestamp,
          cpuPercent: Math.random() * 100,
          memoryPercent: 60 + Math.random() * 30, // 60-90%
          diskPercent: 40 + Math.random() * 20, // 40-60%
          networkBytesIn: Math.floor(Math.random() * 1000000),
          networkBytesOut: Math.floor(Math.random() * 1000000),
          activeProcesses: 150 + Math.floor(Math.random() * 50),
          uptime: Math.floor(Date.now() / 1000) - i * 300 // Seconds
        });
      }
      
      await SystemMetric.bulkCreate(metrics);
      logger.info('✅ Created sample system metrics');
    }

    // Create sample audit logs
    const auditCount = await AuditLog.count();
    if (auditCount === 0) {
      const sampleLogs = [
        {
          action: 'login_success',
          resource: 'auth',
          details: { username: 'admin' },
          success: true,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
          action: 'asset_created',
          resource: 'asset',
          details: { filename: 'sample_audio.mp3' },
          success: true,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
          action: 'processing_job_started',
          resource: 'processing',
          details: { assetName: 'sample_audio.mp3', type: 'signal_morphology' },
          success: true,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
          action: 'processing_job_completed',
          resource: 'processing',
          details: { assetName: 'sample_audio.mp3', type: 'signal_morphology' },
          success: true,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
          action: 'asset_uploaded',
          resource: 'asset',
          details: { filename: 'music_track.wav', platform: 'youtube' },
          success: true,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      ];

      for (let i = 0; i < sampleLogs.length; i++) {
        await AuditLog.create({
          ...sampleLogs[i],
          createdAt: new Date(Date.now() - (sampleLogs.length - i) * 3600000) // Hours ago
        });
      }
      logger.info('✅ Created sample audit logs');
    }

    logger.info('🎉 Test data seeding completed successfully');
    
  } catch (error) {
    logger.error('❌ Test data seeding failed:', error.message);
    throw error;
  }
}

module.exports = { seedTestData };
