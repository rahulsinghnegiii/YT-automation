const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../utils/logger');

class SignalMorphology {
  constructor() {
    this.processedPath = path.join(process.cwd(), 'processed');
    this.overlaysPath = path.join(process.cwd(), 'overlays');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.access(this.processedPath);
    } catch {
      await fs.mkdir(this.processedPath, { recursive: true });
    }
    
    try {
      await fs.access(this.overlaysPath);
    } catch {
      await fs.mkdir(this.overlaysPath, { recursive: true });
    }
  }

  async morphAudio(inputPath, options = {}) {
    try {
      logger.info(`Starting audio morphing: ${inputPath}`);
      
      const inputFilename = path.basename(inputPath, path.extname(inputPath));
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const randomId = Math.random().toString(36).substring(7);
      const outputFilename = `morphed_${inputFilename}_${timestamp}_${randomId}.mp3`;
      const outputPath = path.join(this.processedPath, outputFilename);

      const {
        pitch = 0,
        speed = 1.0,
        volume = 1.0,
        echo = false,
        reverb = false,
        fadeIn = 0,
        fadeOut = 0,
        normalize = false
      } = options;

      return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Build filter chain
        const filters = [];

        // Pitch adjustment
        if (pitch !== 0) {
          const pitchFactor = Math.pow(2, pitch / 12);
          filters.push(`asetrate=44100*${pitchFactor},aresample=44100`);
        }

        // Speed adjustment
        if (speed !== 1.0) {
          filters.push(`atempo=${speed}`);
        }

        // Volume adjustment
        if (volume !== 1.0) {
          filters.push(`volume=${volume}`);
        }

        // Echo effect
        if (echo) {
          filters.push('aecho=0.8:0.88:60:0.4');
        }

        // Reverb effect
        if (reverb) {
          filters.push('areverb=room_size=0.8:damping=0.5:wet_gain=0.3');
        }

        // Fade in/out
        if (fadeIn > 0) {
          filters.push(`afade=t=in:ss=0:d=${fadeIn}`);
        }
        if (fadeOut > 0) {
          filters.push(`afade=t=out:st=${fadeOut}:d=2`);
        }

        // Normalization
        if (normalize) {
          filters.push('loudnorm');
        }

        // Apply filters if any
        if (filters.length > 0) {
          command = command.audioFilter(filters.join(','));
        }

        command
          .output(outputPath)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .on('start', (commandLine) => {
            logger.info(`FFmpeg process started: ${commandLine}`);
          })
          .on('progress', (progress) => {
            logger.info(`Processing progress: ${progress.percent}%`);
          })
          .on('end', () => {
            logger.info(`Audio morphing completed: ${outputPath}`);
            resolve({
              success: true,
              inputPath,
              outputPath,
              filename: outputFilename,
              options: options
            });
          })
          .on('error', (error) => {
            logger.error(`Audio morphing error: ${error.message}`);
            reject(error);
          })
          .run();
      });
    } catch (error) {
      logger.error(`Signal morphology error: ${error.message}`);
      throw error;
    }
  }

  async addBackgroundTrack(inputPath, backgroundPath, options = {}) {
    try {
      logger.info(`Adding background track: ${inputPath} + ${backgroundPath}`);
      
      const inputFilename = path.basename(inputPath, path.extname(inputPath));
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const randomId = Math.random().toString(36).substring(7);
      const outputFilename = `mixed_${inputFilename}_${timestamp}_${randomId}.mp3`;
      const outputPath = path.join(this.processedPath, outputFilename);

      const {
        backgroundVolume = 0.3,
        mainVolume = 1.0,
        crossfade = 0
      } = options;

      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(inputPath)
          .input(backgroundPath)
          .complexFilter([
            `[0:a]volume=${mainVolume}[main]`,
            `[1:a]volume=${backgroundVolume}[bg]`,
            `[main][bg]amix=inputs=2:duration=first:dropout_transition=${crossfade}[out]`
          ])
          .outputOptions('-map', '[out]')
          .output(outputPath)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .on('start', (commandLine) => {
            logger.info(`FFmpeg mixing process started: ${commandLine}`);
          })
          .on('end', () => {
            logger.info(`Background mixing completed: ${outputPath}`);
            resolve({
              success: true,
              inputPath,
              backgroundPath,
              outputPath,
              filename: outputFilename,
              options: options
            });
          })
          .on('error', (error) => {
            logger.error(`Background mixing error: ${error.message}`);
            reject(error);
          })
          .run();
      });
    } catch (error) {
      logger.error(`Background track error: ${error.message}`);
      throw error;
    }
  }

  async analyzeAudio(inputPath) {
    try {
      logger.info(`Analyzing audio: ${inputPath}`);
      
      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (error, metadata) => {
          if (error) {
            logger.error(`Audio analysis error: ${error.message}`);
            reject(error);
            return;
          }

          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
          
          if (!audioStream) {
            reject(new Error('No audio stream found'));
            return;
          }

          const analysis = {
            duration: parseFloat(metadata.format.duration),
            bitrate: parseInt(metadata.format.bit_rate),
            fileSize: parseInt(metadata.format.size),
            codec: audioStream.codec_name,
            sampleRate: parseInt(audioStream.sample_rate),
            channels: audioStream.channels,
            channelLayout: audioStream.channel_layout,
            format: metadata.format.format_name
          };

          logger.info(`Audio analysis completed: ${JSON.stringify(analysis)}`);
          resolve(analysis);
        });
      });
    } catch (error) {
      logger.error(`Audio analysis error: ${error.message}`);
      throw error;
    }
  }

  async convertFormat(inputPath, outputFormat = 'mp3', options = {}) {
    try {
      logger.info(`Converting format: ${inputPath} to ${outputFormat}`);
      
      const inputFilename = path.basename(inputPath, path.extname(inputPath));
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const randomId = Math.random().toString(36).substring(7);
      const outputFilename = `converted_${inputFilename}_${timestamp}_${randomId}.${outputFormat}`;
      const outputPath = path.join(this.processedPath, outputFilename);

      const {
        bitrate = '192k',
        sampleRate = 44100,
        channels = 2
      } = options;

      return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath)
          .output(outputPath)
          .audioBitrate(bitrate)
          .audioFrequency(sampleRate)
          .audioChannels(channels);

        // Set codec based on format
        switch (outputFormat.toLowerCase()) {
          case 'mp3':
            command = command.audioCodec('libmp3lame');
            break;
          case 'wav':
            command = command.audioCodec('pcm_s16le');
            break;
          case 'flac':
            command = command.audioCodec('flac');
            break;
          case 'ogg':
            command = command.audioCodec('libvorbis');
            break;
          default:
            command = command.audioCodec('libmp3lame');
        }

        command
          .on('start', (commandLine) => {
            logger.info(`FFmpeg conversion started: ${commandLine}`);
          })
          .on('end', () => {
            logger.info(`Format conversion completed: ${outputPath}`);
            resolve({
              success: true,
              inputPath,
              outputPath,
              filename: outputFilename,
              format: outputFormat,
              options: options
            });
          })
          .on('error', (error) => {
            logger.error(`Format conversion error: ${error.message}`);
            reject(error);
          })
          .run();
      });
    } catch (error) {
      logger.error(`Format conversion error: ${error.message}`);
      throw error;
    }
  }

  async getProcessingHistory() {
    try {
      const files = await fs.readdir(this.processedPath);
      const history = [];

      for (const file of files) {
        const filePath = path.join(this.processedPath, file);
        const stats = await fs.stat(filePath);
        
        history.push({
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }

      return history.sort((a, b) => b.created - a.created);
    } catch (error) {
      logger.error(`Error getting processing history: ${error.message}`);
      return [];
    }
  }

  async processAsset(asset) {
    try {
      logger.info(`Processing asset with signal morphology: ${asset.filename}`);
      
      if (!asset.originalPath) {
        throw new Error('Asset has no original path');
      }

      // Default processing options for automated processing
      const options = {
        normalize: true,
        volume: 1.0,
        pitch: 0,
        speed: 1.0
      };

      const result = await this.morphAudio(asset.originalPath, options);
      
      return result;
    } catch (error) {
      logger.error(`Failed to process asset ${asset.filename}:`, error);
      throw error;
    }
  }

  async processBatch(files = [], options = {}) {
    try {
      logger.info(`Starting batch processing of ${files.length} files`);
      const results = [];
      
      for (const file of files) {
        try {
          const result = await this.morphAudio(file.path, { ...options, ...file.options });
          results.push({
            file: file,
            result: result,
            success: true
          });
        } catch (error) {
          logger.error(`Batch processing error for file ${file.path}: ${error.message}`);
          results.push({
            file: file,
            error: error.message,
            success: false
          });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      logger.info(`Batch processing completed: ${successful}/${files.length} successful`);
      
      return {
        success: true,
        total: files.length,
        successful: successful,
        failed: files.length - successful,
        results: results
      };
    } catch (error) {
      logger.error(`Batch processing error: ${error.message}`);
      throw error;
    }
  }

  async cleanupProcessedFiles(maxAge = 30) {
    try {
      logger.info(`Cleaning up processed files older than ${maxAge} days`);
      const files = await fs.readdir(this.processedPath);
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.processedPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.birthtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info(`Deleted old processed file: ${file}`);
        }
      }
      
      logger.info(`Processed files cleanup completed: ${deletedCount} files deleted`);
      return { success: true, deletedCount };
    } catch (error) {
      logger.error(`Processed files cleanup error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = SignalMorphology;
