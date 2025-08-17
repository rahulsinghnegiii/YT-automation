const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class YouTubeUploader {
  constructor() {
    this.credentialsPath = path.join(process.cwd(), 'credentials');
    this.uploadsPath = path.join(process.cwd(), 'uploads');
    this.youtube = null;
    this.oauth2Client = null;
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.access(this.uploadsPath);
    } catch {
      await fs.mkdir(this.uploadsPath, { recursive: true });
    }
  }

  async initialize() {
    try {
      // Load OAuth2 credentials
      const credentialsFile = path.join(this.credentialsPath, 'client_secret_youtube.json');
      const credentials = JSON.parse(await fs.readFile(credentialsFile, 'utf8'));
      
      const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed;
      
      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Try to load existing token
      try {
        const tokenFile = path.join(this.credentialsPath, 'youtube_token.json');
        const token = JSON.parse(await fs.readFile(tokenFile, 'utf8'));
        this.oauth2Client.setCredentials(token);
        logger.info('YouTube OAuth2 token loaded successfully');
      } catch (error) {
        logger.warn('No existing YouTube token found, authentication required');
      }

      this.youtube = google.youtube({
        version: 'v3',
        auth: this.oauth2Client
      });

      return { success: true };
    } catch (error) {
      logger.error(`YouTube initialization error: ${error.message}`);
      throw error;
    }
  }

  async getAuthUrl() {
    try {
      const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube'
      ];

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
      });

      return { authUrl };
    } catch (error) {
      logger.error(`Auth URL generation error: ${error.message}`);
      throw error;
    }
  }

  async saveToken(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      const tokenFile = path.join(this.credentialsPath, 'youtube_token.json');
      await fs.writeFile(tokenFile, JSON.stringify(tokens, null, 2));
      
      logger.info('YouTube token saved successfully');
      return { success: true };
    } catch (error) {
      logger.error(`Token save error: ${error.message}`);
      throw error;
    }
  }

  async uploadVideo(filePath, metadata = {}) {
    try {
      if (!this.youtube) {
        await this.initialize();
      }

      logger.info(`Starting YouTube upload: ${filePath}`);

      const {
        title = path.basename(filePath, path.extname(filePath)),
        description = 'Uploaded via automated system',
        tags = [],
        categoryId = '22', // People & Blogs
        privacy = 'private',
        thumbnail = null
      } = metadata;

      const fileSize = (await fs.stat(filePath)).size;
      const media = {
        body: require('fs').createReadStream(filePath)
      };

      const resource = {
        snippet: {
          title: title,
          description: description,
          tags: tags,
          categoryId: categoryId,
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en'
        },
        status: {
          privacyStatus: privacy,
          selfDeclaredMadeForKids: false
        }
      };

      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: resource,
        media: media,
        notifySubscribers: false,
        onUploadProgress: (progress) => {
          const percentComplete = Math.round((progress.bytesRead / fileSize) * 100);
          logger.info(`Upload progress: ${percentComplete}%`);
        }
      });

      const videoId = response.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Upload thumbnail if provided
      if (thumbnail && await this.fileExists(thumbnail)) {
        try {
          await this.uploadThumbnail(videoId, thumbnail);
        } catch (thumbError) {
          logger.warn(`Thumbnail upload failed: ${thumbError.message}`);
        }
      }

      logger.info(`YouTube upload completed: ${videoUrl}`);
      
      return {
        success: true,
        videoId: videoId,
        videoUrl: videoUrl,
        title: title,
        uploadTime: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`YouTube upload error: ${error.message}`);
      throw error;
    }
  }

  async uploadThumbnail(videoId, thumbnailPath) {
    try {
      logger.info(`Uploading thumbnail for video ${videoId}: ${thumbnailPath}`);

      const media = {
        body: require('fs').createReadStream(thumbnailPath)
      };

      await this.youtube.thumbnails.set({
        videoId: videoId,
        media: media
      });

      logger.info(`Thumbnail uploaded successfully for video ${videoId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Thumbnail upload error: ${error.message}`);
      throw error;
    }
  }

  async updateVideo(videoId, updates = {}) {
    try {
      logger.info(`Updating YouTube video: ${videoId}`);

      const resource = {
        id: videoId
      };

      if (updates.title || updates.description || updates.tags) {
        resource.snippet = {};
        if (updates.title) resource.snippet.title = updates.title;
        if (updates.description) resource.snippet.description = updates.description;
        if (updates.tags) resource.snippet.tags = updates.tags;
      }

      if (updates.privacy) {
        resource.status = {
          privacyStatus: updates.privacy
        };
      }

      const parts = [];
      if (resource.snippet) parts.push('snippet');
      if (resource.status) parts.push('status');

      const response = await this.youtube.videos.update({
        part: parts,
        requestBody: resource
      });

      logger.info(`Video updated successfully: ${videoId}`);
      return {
        success: true,
        videoId: videoId,
        updates: updates
      };
    } catch (error) {
      logger.error(`Video update error: ${error.message}`);
      throw error;
    }
  }

  async getVideoInfo(videoId) {
    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'status', 'statistics'],
        id: [videoId]
      });

      if (response.data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = response.data.items[0];
      
      return {
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        publishedAt: video.snippet.publishedAt,
        channelTitle: video.snippet.channelTitle,
        privacyStatus: video.status.privacyStatus,
        views: video.statistics.viewCount,
        likes: video.statistics.likeCount,
        comments: video.statistics.commentCount
      };
    } catch (error) {
      logger.error(`Get video info error: ${error.message}`);
      throw error;
    }
  }

  async deleteVideo(videoId) {
    try {
      logger.info(`Deleting YouTube video: ${videoId}`);

      await this.youtube.videos.delete({
        id: videoId
      });

      logger.info(`Video deleted successfully: ${videoId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Video deletion error: ${error.message}`);
      throw error;
    }
  }

  async getChannelInfo() {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        mine: true
      });

      if (response.data.items.length === 0) {
        throw new Error('No channel found');
      }

      const channel = response.data.items[0];
      
      return {
        channelId: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        subscriberCount: channel.statistics.subscriberCount,
        videoCount: channel.statistics.videoCount,
        viewCount: channel.statistics.viewCount
      };
    } catch (error) {
      logger.error(`Get channel info error: ${error.message}`);
      throw error;
    }
  }

  async listVideos(maxResults = 10) {
    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        forMine: true,
        type: ['video'],
        maxResults: maxResults,
        order: 'date'
      });

      return response.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails.default.url
      }));
    } catch (error) {
      logger.error(`List videos error: ${error.message}`);
      throw error;
    }
  }

  async getUploadQuota() {
    try {
      // This is a simplified quota check
      // In a real implementation, you'd track quota usage
      return {
        dailyLimit: 1600,
        used: 0, // You'd track this based on actual usage
        remaining: 1600,
        resetTime: new Date().setHours(24, 0, 0, 0)
      };
    } catch (error) {
      logger.error(`Quota check error: ${error.message}`);
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

  async getUploadHistory() {
    try {
      const files = await fs.readdir(this.uploadsPath);
      const history = [];

      for (const file of files) {
        const filePath = path.join(this.uploadsPath, file);
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
      logger.error(`Error getting upload history: ${error.message}`);
      return [];
    }
  }

  async uploadAsset(asset) {
    try {
      logger.info(`Uploading asset to YouTube: ${asset.filename}`);
      
      const filePath = asset.processedPath || asset.originalPath;
      
      if (!filePath) {
        throw new Error('Asset has no file path');
      }

      // Default metadata for automated uploads
      const metadata = {
        title: asset.metadata?.title || asset.filename,
        description: asset.metadata?.description || 'Automated upload',
        tags: asset.metadata?.tags || ['automated', 'audio'],
        privacy: 'private' // Always start as private for automated uploads
      };

      await this.initialize();
      const result = await this.uploadVideo(filePath, metadata);
      
      return result;
    } catch (error) {
      logger.error(`Failed to upload asset ${asset.filename}:`, error);
      throw error;
    }
  }

  async uploadBatch(files = [], metadata = {}) {
    try {
      logger.info(`Starting batch upload of ${files.length} files`);
      const results = [];
      
      // Check quota before starting
      const quota = await this.getUploadQuota();
      if (quota.remaining < files.length * 100) { // Rough estimate: 100 quota units per upload
        throw new Error('Insufficient upload quota for batch operation');
      }
      
      for (const file of files) {
        try {
          const fileMetadata = { ...metadata, ...file.metadata };
          const result = await this.uploadVideo(file.path, fileMetadata);
          results.push({
            file: file,
            result: result,
            success: true
          });
          
          // Add delay between uploads to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error(`Batch upload error for file ${file.path}: ${error.message}`);
          results.push({
            file: file,
            error: error.message,
            success: false
          });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      logger.info(`Batch upload completed: ${successful}/${files.length} successful`);
      
      return {
        success: true,
        total: files.length,
        successful: successful,
        failed: files.length - successful,
        results: results
      };
    } catch (error) {
      logger.error(`Batch upload error: ${error.message}`);
      throw error;
    }
  }

  async isAuthenticated() {
    try {
      if (!this.oauth2Client) {
        await this.initialize();
      }
      
      const credentials = this.oauth2Client.credentials;
      return !!(credentials && credentials.access_token);
    } catch (error) {
      logger.error(`Authentication check error: ${error.message}`);
      return false;
    }
  }

  async refreshToken() {
    try {
      if (!this.oauth2Client) {
        await this.initialize();
      }
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      
      // Save updated token
      const tokenFile = path.join(this.credentialsPath, 'youtube_token.json');
      await fs.writeFile(tokenFile, JSON.stringify(credentials, null, 2));
      
      logger.info('YouTube token refreshed successfully');
      return { success: true };
    } catch (error) {
      logger.error(`Token refresh error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = YouTubeUploader;
