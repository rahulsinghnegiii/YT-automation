const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const ytdl = require('ytdl-core');
const logger = require('../utils/logger');

class AssetHarvester {
  constructor() {
    this.downloadPath = path.join(process.cwd(), 'downloads');
    this.ensureDownloadDirectory();
  }

  async ensureDownloadDirectory() {
    try {
      await fs.access(this.downloadPath);
    } catch {
      await fs.mkdir(this.downloadPath, { recursive: true });
    }
  }

  async harvestFromYouTube(url, options = {}) {
    try {
      logger.info(`Starting YouTube harvest from: ${url}`);
      
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await ytdl.getInfo(url);
      const title = this.sanitizeFilename(info.videoDetails.title);
      const outputPath = path.join(this.downloadPath, `${title}.mp3`);

      return new Promise((resolve, reject) => {
        const stream = ytdl(url, {
          filter: 'audioonly',
          quality: 'highestaudio',
          ...options
        });

        const writeStream = require('fs').createWriteStream(outputPath);
        
        stream.pipe(writeStream);
        
        stream.on('error', reject);
        writeStream.on('error', reject);
        
        writeStream.on('finish', () => {
          logger.info(`Successfully harvested: ${outputPath}`);
          resolve({
            success: true,
            filePath: outputPath,
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            url: url
          });
        });
      });
    } catch (error) {
      logger.error(`YouTube harvest error: ${error.message}`);
      throw error;
    }
  }

  async harvestFromURL(url, options = {}) {
    try {
      logger.info(`Starting URL harvest from: ${url}`);
      
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000,
        ...options
      });

      const filename = this.extractFilenameFromURL(url) || `download_${Date.now()}`;
      const outputPath = path.join(this.downloadPath, filename);
      
      const writeStream = require('fs').createWriteStream(outputPath);
      
      return new Promise((resolve, reject) => {
        response.data.pipe(writeStream);
        
        response.data.on('error', reject);
        writeStream.on('error', reject);
        
        writeStream.on('finish', () => {
          logger.info(`Successfully harvested: ${outputPath}`);
          resolve({
            success: true,
            filePath: outputPath,
            url: url,
            size: writeStream.bytesWritten
          });
        });
      });
    } catch (error) {
      logger.error(`URL harvest error: ${error.message}`);
      throw error;
    }
  }

  async harvestAudioFromText(text, options = {}) {
    try {
      logger.info('Starting text-to-audio harvest');
      
      // This would integrate with a TTS service like Google TTS, AWS Polly, etc.
      // For now, creating a placeholder text file
      const filename = `text_${Date.now()}.txt`;
      const outputPath = path.join(this.downloadPath, filename);
      
      await fs.writeFile(outputPath, text);
      
      logger.info(`Successfully created text file: ${outputPath}`);
      return {
        success: true,
        filePath: outputPath,
        type: 'text',
        content: text
      };
    } catch (error) {
      logger.error(`Text harvest error: ${error.message}`);
      throw error;
    }
  }

  async harvestFromSources() {
    try {
      logger.info('Starting automated harvest from configured sources');
      
      // This would harvest from configured sources (URLs, feeds, etc.)
      // For now, implementing a basic example
      const sources = process.env.HARVEST_SOURCES ? 
        JSON.parse(process.env.HARVEST_SOURCES) : 
        [];

      const results = [];
      
      for (const source of sources) {
        try {
          let result;
          
          if (source.type === 'youtube') {
            result = await this.harvestFromYouTube(source.url, source.options);
          } else if (source.type === 'url') {
            result = await this.harvestFromURL(source.url, source.options);
          } else if (source.type === 'text') {
            result = await this.harvestAudioFromText(source.content, source.options);
          }
          
          if (result) {
            results.push(result);
            logger.info(`Successfully harvested from source: ${source.url || 'text'}`);
          }
        } catch (sourceError) {
          logger.error(`Failed to harvest from source ${source.url}:`, sourceError);
        }
      }
      
      logger.info(`Automated harvest completed. ${results.length} assets harvested.`);
      return results;
    } catch (error) {
      logger.error(`Automated harvest error: ${error.message}`);
      throw error;
    }
  }

  async harvestBatch(sources = []) {
    try {
      logger.info(`Starting batch harvest of ${sources.length} sources`);
      const results = [];
      
      for (const source of sources) {
        try {
          let result;
          
          if (source.type === 'youtube') {
            result = await this.harvestFromYouTube(source.url, source.options);
          } else if (source.type === 'url') {
            result = await this.harvestFromURL(source.url, source.options);
          } else if (source.type === 'text') {
            result = await this.harvestAudioFromText(source.text, source.options);
          } else {
            throw new Error(`Unknown source type: ${source.type}`);
          }
          
          results.push({
            source: source,
            result: result,
            success: true
          });
        } catch (error) {
          logger.error(`Batch harvest error for source ${JSON.stringify(source)}: ${error.message}`);
          results.push({
            source: source,
            error: error.message,
            success: false
          });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      logger.info(`Batch harvest completed: ${successful}/${sources.length} successful`);
      
      return {
        success: true,
        total: sources.length,
        successful: successful,
        failed: sources.length - successful,
        results: results
      };
    } catch (error) {
      logger.error(`Batch harvest error: ${error.message}`);
      throw error;
    }
  }

  async cleanupOldFiles(maxAge = 7) {
    try {
      logger.info(`Cleaning up files older than ${maxAge} days`);
      const files = await fs.readdir(this.downloadPath);
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.downloadPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.birthtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info(`Deleted old file: ${file}`);
        }
      }
      
      logger.info(`Cleanup completed: ${deletedCount} files deleted`);
      return { success: true, deletedCount };
    } catch (error) {
      logger.error(`Cleanup error: ${error.message}`);
      throw error;
    }
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  extractFilenameFromURL(url) {
    try {
      const pathname = new URL(url).pathname;
      const filename = path.basename(pathname);
      return filename || null;
    } catch {
      return null;
    }
  }

  async getHarvestHistory() {
    try {
      const files = await fs.readdir(this.downloadPath);
      const history = [];

      for (const file of files) {
        const filePath = path.join(this.downloadPath, file);
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
      logger.error(`Error getting harvest history: ${error.message}`);
      return [];
    }
  }

  async deleteHarvestedFile(filename) {
    try {
      const filePath = path.join(this.downloadPath, filename);
      await fs.unlink(filePath);
      logger.info(`Deleted harvested file: ${filePath}`);
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AssetHarvester;
