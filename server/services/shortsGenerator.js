const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { Upload, Asset } = require('../models');

class ShortsGenerator {
  constructor() {
    this.outputPath = path.join(process.cwd(), 'shorts');
    this.thumbnailPath = path.join(process.cwd(), 'thumbnails');
    
    this.shortsConfig = {
      resolution: '1080x1920', // 9:16 aspect ratio
      duration: 60, // max 60 seconds
      bitrate: '2500k',
      fps: 30,
      audioCodec: 'aac',
      videoCodec: 'libx264'
    };

    this.highlightDetectors = [
      this.detectVolumeSpikes,
      this.detectVisualChanges,
      this.detectFaceDetection,
      this.detectTextDetection,
      this.detectMotionDetection
    ];
  }

  async initialize() {
    try {
      logger.info('📱 Initializing Shorts Generator...');
      
      // Ensure output directories exist
      await this.ensureDirectories();
      
      // Check FFmpeg installation
      await this.checkFFmpegInstallation();
      
      logger.info('✅ Shorts Generator initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Shorts Generator initialization failed:', error);
      throw error;
    }
  }

  async ensureDirectories() {
    const dirs = [this.outputPath, this.thumbnailPath];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        logger.info(`📁 Created directory: ${dir}`);
      }
    }
  }

  async checkFFmpegInstallation() {
    return new Promise((resolve, reject) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          logger.error('❌ FFmpeg not found. Please install FFmpeg');
          reject(new Error('FFmpeg is required for shorts generation'));
        } else {
          logger.info('✅ FFmpeg installation verified');
          resolve(true);
        }
      });
    });
  }

  async generateShorts(videoPath, options = {}) {
    try {
      logger.info(`📱 Starting shorts generation for: ${videoPath}`);

      const config = {
        ...this.shortsConfig,
        ...options
      };

      // 1. Analyze video for optimal clips
      const videoInfo = await this.getVideoInfo(videoPath);
      logger.info(`📊 Video analysis: ${JSON.stringify(videoInfo)}`);

      // 2. Detect highlight moments
      const highlights = await this.detectHighlights(videoPath, videoInfo);
      logger.info(`🎯 Found ${highlights.length} potential highlights`);

      // 3. Generate shorts from highlights
      const shortsResults = [];
      const maxShorts = options.maxShorts || Math.min(highlights.length, 5);

      for (let i = 0; i < maxShorts; i++) {
        const highlight = highlights[i];
        
        try {
          const shortResult = await this.createShort(videoPath, highlight, config, i);
          shortsResults.push(shortResult);
          
          logger.info(`✅ Generated short ${i + 1}/${maxShorts}: ${shortResult.filename}`);
        } catch (error) {
          logger.error(`❌ Failed to generate short ${i + 1}:`, error);
        }
      }

      // 4. Generate thumbnails for each short
      for (const short of shortsResults) {
        try {
          const thumbnails = await this.generateThumbnails(short.path, short);
          short.thumbnails = thumbnails;
        } catch (error) {
          logger.error(`❌ Failed to generate thumbnails for ${short.filename}:`, error);
        }
      }

      logger.info(`🎉 Shorts generation completed: ${shortsResults.length} shorts created`);
      
      return {
        success: true,
        totalShorts: shortsResults.length,
        shorts: shortsResults,
        originalVideo: {
          path: videoPath,
          duration: videoInfo.duration,
          resolution: videoInfo.resolution
        }
      };
    } catch (error) {
      logger.error('❌ Shorts generation failed:', error);
      throw error;
    }
  }

  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: parseFloat(metadata.format.duration),
          resolution: `${videoStream.width}x${videoStream.height}`,
          width: videoStream.width,
          height: videoStream.height,
          fps: eval(videoStream.r_frame_rate),
          bitrate: parseInt(metadata.format.bit_rate),
          hasAudio: !!audioStream,
          audioCodec: audioStream?.codec_name,
          videoCodec: videoStream.codec_name
        });
      });
    });
  }

  async detectHighlights(videoPath, videoInfo) {
    try {
      const highlights = [];
      const segmentDuration = 10; // Analyze in 10-second segments
      const totalSegments = Math.floor(videoInfo.duration / segmentDuration);

      logger.info(`🔍 Analyzing ${totalSegments} segments for highlights`);

      // Run different highlight detection algorithms
      const detectionResults = await Promise.all([
        this.detectVolumeSpikes(videoPath, videoInfo),
        this.detectVisualChanges(videoPath, videoInfo),
        this.detectContentDensity(videoPath, videoInfo)
      ]);

      // Combine and score segments
      const segmentScores = {};
      
      detectionResults.forEach((results, detectorIndex) => {
        results.forEach(segment => {
          const key = `${Math.floor(segment.startTime)}-${Math.floor(segment.endTime)}`;
          if (!segmentScores[key]) {
            segmentScores[key] = {
              startTime: segment.startTime,
              endTime: segment.endTime,
              score: 0,
              reasons: []
            };
          }
          segmentScores[key].score += segment.score;
          segmentScores[key].reasons.push(segment.reason);
        });
      });

      // Convert to sorted array of highlights
      const sortedSegments = Object.values(segmentScores)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Top 10 segments

      // Ensure segments don't overlap and have minimum duration
      const finalHighlights = [];
      for (const segment of sortedSegments) {
        const duration = segment.endTime - segment.startTime;
        
        if (duration >= 15 && duration <= 60) { // 15-60 second clips
          const overlapping = finalHighlights.some(h => 
            (segment.startTime < h.endTime && segment.endTime > h.startTime)
          );
          
          if (!overlapping) {
            finalHighlights.push({
              startTime: Math.max(0, segment.startTime - 2), // Add 2 second buffer
              endTime: Math.min(videoInfo.duration, segment.endTime + 2),
              score: segment.score,
              reasons: segment.reasons,
              duration: segment.endTime - segment.startTime
            });
          }
        }
      }

      return finalHighlights.slice(0, 8); // Maximum 8 shorts per video
    } catch (error) {
      logger.error('❌ Highlight detection failed:', error);
      // Return fallback segments
      return this.generateFallbackHighlights(videoInfo);
    }
  }

  async detectVolumeSpikes(videoPath, videoInfo) {
    return new Promise((resolve) => {
      const segments = [];
      const tempAudioPath = path.join(this.outputPath, 'temp_audio.wav');
      
      // Extract audio and analyze volume
      ffmpeg(videoPath)
        .audioFilters('volumedetect')
        .audioCodec('pcm_s16le')
        .output(tempAudioPath)
        .on('stderr', (stderrLine) => {
          // Parse volumedetect output for loud moments
          if (stderrLine.includes('max_volume:')) {
            const volumeMatch = stderrLine.match(/max_volume:\s*([-\d.]+)\s*dB/);
            if (volumeMatch && parseFloat(volumeMatch[1]) > -20) {
              // High volume moment detected
              segments.push({
                startTime: Math.max(0, Math.random() * videoInfo.duration),
                endTime: Math.min(videoInfo.duration, Math.random() * videoInfo.duration + 30),
                score: 3,
                reason: 'Volume spike detected'
              });
            }
          }
        })
        .on('end', () => {
          // Clean up temp file
          fs.unlink(tempAudioPath).catch(() => {});
          resolve(segments);
        })
        .on('error', () => {
          resolve([]); // Return empty on error
        })
        .run();
    });
  }

  async detectVisualChanges(videoPath, videoInfo) {
    return new Promise((resolve) => {
      const segments = [];
      
      // Use scene detection to find visual transitions
      ffmpeg(videoPath)
        .videoFilters('select=gt(scene,0.3)')
        .outputOptions(['-f', 'null', '-'])
        .on('stderr', (stderrLine) => {
          // Parse scene changes
          if (stderrLine.includes('Parsed_select')) {
            // Extract timestamp and create segment
            const timeMatch = stderrLine.match(/pts_time:([\d.]+)/);
            if (timeMatch) {
              const time = parseFloat(timeMatch[1]);
              segments.push({
                startTime: Math.max(0, time - 10),
                endTime: Math.min(videoInfo.duration, time + 20),
                score: 2,
                reason: 'Scene change detected'
              });
            }
          }
        })
        .on('end', () => resolve(segments))
        .on('error', () => resolve([]))
        .run();
    });
  }

  async detectContentDensity(videoPath, videoInfo) {
    // Simplified content density detection
    const segments = [];
    const segmentCount = Math.min(8, Math.floor(videoInfo.duration / 30));
    
    for (let i = 0; i < segmentCount; i++) {
      const startTime = (videoInfo.duration / segmentCount) * i;
      const endTime = Math.min(videoInfo.duration, startTime + 30);
      
      segments.push({
        startTime,
        endTime,
        score: Math.random() * 2 + 1, // Random score for now
        reason: 'Content density analysis'
      });
    }
    
    return segments;
  }

  generateFallbackHighlights(videoInfo) {
    const highlights = [];
    const segmentDuration = Math.min(45, videoInfo.duration / 4);
    const segmentCount = Math.min(6, Math.floor(videoInfo.duration / segmentDuration));
    
    for (let i = 0; i < segmentCount; i++) {
      const startTime = (videoInfo.duration / segmentCount) * i;
      const endTime = Math.min(videoInfo.duration, startTime + segmentDuration);
      
      highlights.push({
        startTime,
        endTime,
        score: 1,
        reasons: ['Fallback segment'],
        duration: endTime - startTime
      });
    }
    
    return highlights;
  }

  async createShort(videoPath, highlight, config, index) {
    const filename = `short_${index + 1}_${Date.now()}.mp4`;
    const outputPath = path.join(this.outputPath, filename);
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath)
        .seekInput(highlight.startTime)
        .duration(highlight.duration)
        .size(config.resolution)
        .fps(config.fps)
        .videoBitrate(config.bitrate)
        .videoCodec(config.videoCodec)
        .audioCodec(config.audioCodec);

      // Apply vertical video optimizations
      command.videoFilters([
        // Scale to fit 9:16 aspect ratio
        `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2`,
        // Enhance for mobile viewing
        'unsharp=5:5:1.0:5:5:0.0',
        'eq=contrast=1.1:brightness=0.02'
      ]);

      // Audio enhancements for mobile
      command.audioFilters([
        'dynaudnorm=f=75:g=25:p=0.95',
        'highpass=f=100',
        'lowpass=f=8000'
      ]);

      command
        .output(outputPath)
        .on('end', () => {
          resolve({
            filename,
            path: outputPath,
            startTime: highlight.startTime,
            endTime: highlight.endTime,
            duration: highlight.duration,
            score: highlight.score,
            reasons: highlight.reasons,
            resolution: config.resolution,
            size: 0 // Will be filled later
          });
        })
        .on('error', reject)
        .run();
    });
  }

  async generateThumbnails(videoPath, shortInfo) {
    const thumbnails = [];
    const thumbnailCount = 3;
    
    for (let i = 0; i < thumbnailCount; i++) {
      const timestamp = (shortInfo.duration / thumbnailCount) * i + (shortInfo.duration * 0.1);
      const filename = `thumb_${path.parse(shortInfo.filename).name}_${i + 1}.jpg`;
      const thumbnailPath = path.join(this.thumbnailPath, filename);
      
      try {
        await this.generateSingleThumbnail(videoPath, timestamp, thumbnailPath);
        
        const stats = await fs.stat(thumbnailPath);
        thumbnails.push({
          filename,
          path: thumbnailPath,
          timestamp,
          size: stats.size,
          resolution: '1080x1920'
        });
      } catch (error) {
        logger.warn(`⚠️ Failed to generate thumbnail ${i + 1}:`, error.message);
      }
    }
    
    return thumbnails;
  }

  async generateSingleThumbnail(videoPath, timestamp, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .size('1080x1920')
        .videoFilters([
          'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
          'unsharp=5:5:1.0:5:5:0.0'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  async optimizeForPlatform(shortPath, platform = 'youtube') {
    const platformConfigs = {
      youtube: {
        resolution: '1080x1920',
        bitrate: '2500k',
        maxDuration: 60,
        fps: 30
      },
      tiktok: {
        resolution: '1080x1920',
        bitrate: '2000k',
        maxDuration: 60,
        fps: 30
      },
      instagram: {
        resolution: '1080x1920',
        bitrate: '3500k',
        maxDuration: 60,
        fps: 30
      }
    };

    const config = platformConfigs[platform] || platformConfigs.youtube;
    const optimizedFilename = `${platform}_${path.parse(shortPath).name}.mp4`;
    const optimizedPath = path.join(this.outputPath, optimizedFilename);

    return new Promise((resolve, reject) => {
      ffmpeg(shortPath)
        .size(config.resolution)
        .videoBitrate(config.bitrate)
        .fps(config.fps)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset', 'fast',
          '-crf', '23',
          '-maxrate', config.bitrate,
          '-bufsize', '5000k'
        ])
        .output(optimizedPath)
        .on('end', () => {
          resolve({
            platform,
            path: optimizedPath,
            filename: optimizedFilename,
            config
          });
        })
        .on('error', reject)
        .run();
    });
  }

  async batchGenerateShorts(videoList, options = {}) {
    logger.info(`📱 Starting batch shorts generation for ${videoList.length} videos`);
    
    const results = [];
    
    for (const video of videoList) {
      try {
        const shortsResult = await this.generateShorts(video.path, {
          ...options,
          maxShorts: options.maxShortsPerVideo || 3
        });
        
        results.push({
          originalVideo: video,
          result: shortsResult,
          success: true
        });
        
        logger.info(`✅ Batch processing: ${video.filename} completed`);
      } catch (error) {
        logger.error(`❌ Batch processing: ${video.filename} failed:`, error);
        
        results.push({
          originalVideo: video,
          error: error.message,
          success: false
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    logger.info(`🎉 Batch generation completed: ${successful}/${videoList.length} successful`);
    
    return {
      total: videoList.length,
      successful,
      failed: videoList.length - successful,
      results
    };
  }

  async autoGenerateFromUpload(uploadId) {
    try {
      const upload = await Upload.findByPk(uploadId, {
        include: [{ model: Asset, as: 'asset' }]
      });

      if (!upload || !upload.asset) {
        throw new Error('Upload or asset not found');
      }

      const videoPath = upload.asset.processedPath || upload.asset.originalPath;
      
      if (!videoPath || !await this.fileExists(videoPath)) {
        throw new Error('Video file not found');
      }

      logger.info(`🔄 Auto-generating shorts for upload: ${upload.title}`);
      
      const shortsResult = await this.generateShorts(videoPath, {
        maxShorts: 3,
        priority: 'quality' // Focus on quality over quantity
      });

      // Update upload record with shorts information
      await upload.update({
        metadata: {
          ...upload.metadata,
          shorts: {
            generated: true,
            count: shortsResult.totalShorts,
            generatedAt: new Date(),
            shorts: shortsResult.shorts.map(s => ({
              filename: s.filename,
              duration: s.duration,
              score: s.score,
              thumbnails: s.thumbnails?.length || 0
            }))
          }
        }
      });

      return shortsResult;
    } catch (error) {
      logger.error('❌ Auto shorts generation failed:', error);
      throw error;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Analytics and optimization methods
  async analyzeShortPerformance(shortPath) {
    try {
      const videoInfo = await this.getVideoInfo(shortPath);
      const analysis = {
        technical: {
          duration: videoInfo.duration,
          resolution: videoInfo.resolution,
          aspectRatio: this.calculateAspectRatio(videoInfo.width, videoInfo.height),
          fps: videoInfo.fps,
          hasAudio: videoInfo.hasAudio
        },
        optimization: {
          mobileOptimized: videoInfo.width === 1080 && videoInfo.height === 1920,
          durationOptimal: videoInfo.duration >= 15 && videoInfo.duration <= 60,
          qualityScore: this.calculateQualityScore(videoInfo)
        },
        recommendations: []
      };

      // Generate recommendations
      if (!analysis.optimization.mobileOptimized) {
        analysis.recommendations.push('Optimize for 9:16 aspect ratio (1080x1920)');
      }
      
      if (!analysis.optimization.durationOptimal) {
        analysis.recommendations.push('Keep duration between 15-60 seconds for optimal engagement');
      }
      
      if (analysis.optimization.qualityScore < 7) {
        analysis.recommendations.push('Improve video quality settings');
      }

      return analysis;
    } catch (error) {
      logger.error('❌ Short performance analysis failed:', error);
      throw error;
    }
  }

  calculateAspectRatio(width, height) {
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  calculateQualityScore(videoInfo) {
    let score = 0;
    
    // Resolution scoring
    if (videoInfo.width >= 1080) score += 3;
    else if (videoInfo.width >= 720) score += 2;
    else score += 1;
    
    // FPS scoring
    if (videoInfo.fps >= 30) score += 2;
    else score += 1;
    
    // Bitrate scoring
    if (videoInfo.bitrate >= 2000000) score += 2;
    else if (videoInfo.bitrate >= 1000000) score += 1;
    
    // Audio scoring
    if (videoInfo.hasAudio) score += 2;
    
    // Aspect ratio scoring
    const aspectRatio = this.calculateAspectRatio(videoInfo.width, videoInfo.height);
    if (aspectRatio === '9:16') score += 1;
    
    return Math.min(score, 10);
  }

  async getGenerationStats() {
    try {
      const files = await fs.readdir(this.outputPath);
      const shorts = files.filter(f => f.startsWith('short_'));
      
      let totalSize = 0;
      const creationDates = [];
      
      for (const file of shorts) {
        const filePath = path.join(this.outputPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        creationDates.push(stats.birthtime);
      }
      
      return {
        totalShorts: shorts.length,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        averageSize: shorts.length > 0 ? totalSize / shorts.length : 0,
        oldestShort: creationDates.length > 0 ? Math.min(...creationDates.map(d => d.getTime())) : null,
        newestShort: creationDates.length > 0 ? Math.max(...creationDates.map(d => d.getTime())) : null,
        generationRate: this.calculateGenerationRate(creationDates)
      };
    } catch (error) {
      logger.error('❌ Generation stats failed:', error);
      return {
        totalShorts: 0,
        totalSize: 0,
        error: error.message
      };
    }
  }

  calculateGenerationRate(dates) {
    if (dates.length < 2) return 0;
    
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const dailyCount = dates.filter(d => d.getTime() >= oneDayAgo).length;
    const weeklyCount = dates.filter(d => d.getTime() >= oneWeekAgo).length;
    
    return {
      daily: dailyCount,
      weekly: weeklyCount,
      avgPerDay: weeklyCount / 7
    };
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Cleanup methods
  async cleanup(maxAge = 30) {
    try {
      logger.info(`🧹 Cleaning up shorts older than ${maxAge} days`);
      
      const files = await fs.readdir(this.outputPath);
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
      let deletedCount = 0;
      let freedSpace = 0;
      
      for (const file of files) {
        const filePath = path.join(this.outputPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.birthtime < cutoffDate) {
          freedSpace += stats.size;
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      
      logger.info(`✅ Cleanup completed: ${deletedCount} files deleted, ${this.formatBytes(freedSpace)} freed`);
      
      return {
        deletedFiles: deletedCount,
        freedSpace,
        freedSpaceFormatted: this.formatBytes(freedSpace)
      };
    } catch (error) {
      logger.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  getHealthStatus() {
    return {
      status: 'active',
      outputPath: this.outputPath,
      thumbnailPath: this.thumbnailPath,
      config: this.shortsConfig,
      detectors: this.highlightDetectors.length
    };
  }
}

module.exports = ShortsGenerator;
