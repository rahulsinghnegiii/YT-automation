const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { ChannelConfig } = require('../models');

class MultiChannelManager {
  constructor() {
    this.channelClients = new Map();
    this.quotaTracker = new Map();
    this.rateLimitQueue = new Map();
    this.backoffTracker = new Map();
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Multi-Channel Manager...');
      
      // Load all active channel configurations
      const channels = await ChannelConfig.findAll({
        where: { isActive: true }
      });

      for (const channel of channels) {
        await this.initializeChannel(channel);
      }

      logger.info(`✅ Multi-Channel Manager initialized with ${channels.length} channels`);
      return true;
    } catch (error) {
      logger.error('❌ Multi-Channel Manager initialization failed:', error);
      throw error;
    }
  }

  async initializeChannel(channelConfig) {
    try {
      const channelId = channelConfig.channelId;
      
      // Parse client secret
      const clientSecretData = JSON.parse(channelConfig.clientSecret);
      const { client_secret, client_id, redirect_uris } = clientSecretData.web || clientSecretData.installed;

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Set stored tokens if available
      if (channelConfig.accessToken && channelConfig.refreshToken) {
        oauth2Client.setCredentials({
          access_token: channelConfig.accessToken,
          refresh_token: channelConfig.refreshToken,
          expiry_date: channelConfig.tokenExpiry ? new Date(channelConfig.tokenExpiry).getTime() : null
        });
      }

      // Create YouTube client
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });

      // Store client configuration
      this.channelClients.set(channelId, {
        config: channelConfig,
        oauth2Client,
        youtube,
        lastUsed: Date.now(),
        consecutiveErrors: 0
      });

      // Initialize quota tracking
      this.initializeQuotaTracking(channelId, channelConfig);

      logger.info(`✅ Initialized channel: ${channelConfig.name} (${channelId})`);
      
      // Update last active timestamp
      await channelConfig.update({ lastActive: new Date() });

    } catch (error) {
      logger.error(`❌ Failed to initialize channel ${channelConfig.name}:`, error);
      
      // Update error count
      await channelConfig.update({
        errorCount: channelConfig.errorCount + 1,
        lastError: error.message
      });
      
      throw error;
    }
  }

  initializeQuotaTracking(channelId, channelConfig) {
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setUTCHours(0, 0, 0, 0);
    resetTime.setUTCDate(resetTime.getUTCDate() + 1); // Next day at midnight UTC

    this.quotaTracker.set(channelId, {
      used: channelConfig.quotaUsed || 0,
      limit: channelConfig.quotaLimit || 10000,
      resetTime: channelConfig.quotaResetTime || resetTime,
      safetyThreshold: 0.8 // 80% of quota
    });

    this.rateLimitQueue.set(channelId, []);
    this.backoffTracker.set(channelId, {
      retryCount: 0,
      nextRetryTime: 0,
      baseDelay: 1000
    });
  }

  async getOptimalChannel(requireQuota = 100) {
    const availableChannels = [];
    
    for (const [channelId, client] of this.channelClients.entries()) {
      const quota = this.quotaTracker.get(channelId);
      const backoff = this.backoffTracker.get(channelId);
      
      // Check if channel is available
      if (client.config.isActive && 
          quota.used + requireQuota <= quota.limit * quota.safetyThreshold &&
          Date.now() >= backoff.nextRetryTime &&
          client.consecutiveErrors < 3) {
        
        availableChannels.push({
          channelId,
          client,
          quota,
          lastUsed: client.lastUsed,
          errorCount: client.consecutiveErrors,
          remainingQuota: quota.limit - quota.used
        });
      }
    }

    if (availableChannels.length === 0) {
      throw new Error('No available channels with sufficient quota');
    }

    // Sort by remaining quota (descending) and last used (ascending)
    availableChannels.sort((a, b) => {
      const quotaDiff = b.remainingQuota - a.remainingQuota;
      if (Math.abs(quotaDiff) < 100) {
        return a.lastUsed - b.lastUsed; // Use least recently used
      }
      return quotaDiff;
    });

    const selectedChannel = availableChannels[0];
    logger.info(`📊 Selected channel ${selectedChannel.channelId} with ${selectedChannel.remainingQuota} quota remaining`);
    
    return selectedChannel;
  }

  async executeWithQuotaTracking(channelId, operation, quotaCost = 1) {
    const client = this.channelClients.get(channelId);
    const quota = this.quotaTracker.get(channelId);
    const backoff = this.backoffTracker.get(channelId);

    if (!client || !quota) {
      throw new Error(`Channel ${channelId} not initialized`);
    }

    // Check quota availability
    if (quota.used + quotaCost > quota.limit) {
      throw new Error(`Insufficient quota for channel ${channelId}`);
    }

    // Check backoff status
    if (Date.now() < backoff.nextRetryTime) {
      throw new Error(`Channel ${channelId} is in backoff until ${new Date(backoff.nextRetryTime)}`);
    }

    try {
      // Execute operation with exponential backoff retry logic
      const result = await this.executeWithBackoff(client, operation);
      
      // Update quota usage
      await this.updateQuotaUsage(channelId, quotaCost);
      
      // Reset error tracking on success
      client.consecutiveErrors = 0;
      client.lastUsed = Date.now();
      
      // Reset backoff on success
      backoff.retryCount = 0;
      backoff.nextRetryTime = 0;
      
      return result;
    } catch (error) {
      await this.handleOperationError(channelId, error);
      throw error;
    }
  }

  async executeWithBackoff(client, operation) {
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000;

    while (retryCount <= maxRetries) {
      try {
        // Check and refresh token if needed
        await this.ensureValidToken(client);
        
        // Execute operation
        return await operation(client.youtube);
      } catch (error) {
        retryCount++;
        
        if (this.isRetryableError(error) && retryCount <= maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount - 1) + Math.random() * 1000;
          logger.warn(`⚠️ Operation failed, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries}):`, error.message);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
  }

  async ensureValidToken(client) {
    try {
      const credentials = client.oauth2Client.credentials;
      
      if (!credentials.access_token) {
        throw new Error('No access token available');
      }

      // Check if token is expired
      if (credentials.expiry_date && Date.now() >= credentials.expiry_date - 60000) { // Refresh 1 minute before expiry
        logger.info('🔄 Refreshing expired token...');
        
        const { credentials: newCredentials } = await client.oauth2Client.refreshAccessToken();
        client.oauth2Client.setCredentials(newCredentials);
        
        // Update database
        await client.config.update({
          accessToken: newCredentials.access_token,
          refreshToken: newCredentials.refresh_token || client.config.refreshToken,
          tokenExpiry: newCredentials.expiry_date ? new Date(newCredentials.expiry_date) : null
        });
        
        logger.info('✅ Token refreshed successfully');
      }
    } catch (error) {
      logger.error('❌ Token refresh failed:', error);
      throw error;
    }
  }

  isRetryableError(error) {
    const retryableErrors = [
      'rateLimitExceeded',
      'quotaExceeded',
      'internalServerError',
      'backendError',
      'serviceUnavailable',
      'ECONNRESET',
      'ETIMEDOUT'
    ];

    const errorCode = error.code || error.message;
    return retryableErrors.some(code => 
      errorCode.toLowerCase().includes(code.toLowerCase())
    );
  }

  async handleOperationError(channelId, error) {
    const client = this.channelClients.get(channelId);
    const backoff = this.backoffTracker.get(channelId);

    client.consecutiveErrors++;

    // Handle specific error types
    if (error.code === 403 && error.message.includes('quotaExceeded')) {
      await this.handleQuotaExceeded(channelId);
    } else if (error.code === 429 || error.message.includes('rateLimitExceeded')) {
      await this.handleRateLimitExceeded(channelId, error);
    } else {
      // General backoff
      backoff.retryCount++;
      const delay = Math.min(
        backoff.baseDelay * Math.pow(2, backoff.retryCount),
        300000 // Max 5 minutes
      );
      backoff.nextRetryTime = Date.now() + delay;
    }

    // Update database error tracking
    await client.config.update({
      errorCount: client.config.errorCount + 1,
      lastError: error.message
    });

    logger.error(`❌ Channel ${channelId} error (consecutive: ${client.consecutiveErrors}):`, error.message);
  }

  async handleQuotaExceeded(channelId) {
    const quota = this.quotaTracker.get(channelId);
    
    // Mark quota as exceeded
    quota.used = quota.limit;
    
    // Calculate time until quota reset
    const now = Date.now();
    const resetTime = quota.resetTime.getTime();
    const waitTime = Math.max(resetTime - now, 0);
    
    logger.warn(`⚠️ Quota exceeded for channel ${channelId}. Reset in ${Math.round(waitTime / 1000 / 60)} minutes`);
  }

  async handleRateLimitExceeded(channelId, error) {
    const backoff = this.backoffTracker.get(channelId);
    
    // Extract retry-after header if available
    let retryAfter = 60; // Default 60 seconds
    if (error.response && error.response.headers['retry-after']) {
      retryAfter = parseInt(error.response.headers['retry-after']);
    }
    
    backoff.nextRetryTime = Date.now() + (retryAfter * 1000);
    
    logger.warn(`⚠️ Rate limit exceeded for channel ${channelId}. Retry after ${retryAfter} seconds`);
  }

  async updateQuotaUsage(channelId, cost) {
    const quota = this.quotaTracker.get(channelId);
    const client = this.channelClients.get(channelId);
    
    quota.used += cost;
    
    // Update database every 10 quota units or when approaching limit
    if (quota.used % 10 === 0 || quota.used >= quota.limit * 0.9) {
      await client.config.update({ quotaUsed: quota.used });
    }
  }

  async resetDailyQuotas() {
    logger.info('🔄 Resetting daily quotas for all channels...');
    
    for (const [channelId, quota] of this.quotaTracker.entries()) {
      const client = this.channelClients.get(channelId);
      
      quota.used = 0;
      const resetTime = new Date();
      resetTime.setUTCHours(0, 0, 0, 0);
      resetTime.setUTCDate(resetTime.getUTCDate() + 1);
      quota.resetTime = resetTime;
      
      await client.config.update({
        quotaUsed: 0,
        quotaResetTime: resetTime,
        errorCount: 0
      });
    }
    
    logger.info('✅ Daily quotas reset completed');
  }

  // Channel management methods
  async addChannel(channelData) {
    try {
      const channelConfig = await ChannelConfig.create(channelData);
      await this.initializeChannel(channelConfig);
      
      logger.info(`✅ Added new channel: ${channelData.name}`);
      return channelConfig;
    } catch (error) {
      logger.error('❌ Failed to add channel:', error);
      throw error;
    }
  }

  async removeChannel(channelId) {
    try {
      // Remove from memory
      this.channelClients.delete(channelId);
      this.quotaTracker.delete(channelId);
      this.rateLimitQueue.delete(channelId);
      this.backoffTracker.delete(channelId);
      
      // Deactivate in database
      const channel = await ChannelConfig.findOne({ where: { channelId } });
      if (channel) {
        await channel.update({ isActive: false });
      }
      
      logger.info(`✅ Removed channel: ${channelId}`);
    } catch (error) {
      logger.error(`❌ Failed to remove channel ${channelId}:`, error);
      throw error;
    }
  }

  async getChannelStatus(channelId = null) {
    if (channelId) {
      const client = this.channelClients.get(channelId);
      const quota = this.quotaTracker.get(channelId);
      const backoff = this.backoffTracker.get(channelId);
      
      if (!client) return null;
      
      return {
        channelId,
        name: client.config.name,
        isActive: client.config.isActive,
        quota: {
          used: quota.used,
          limit: quota.limit,
          remaining: quota.limit - quota.used,
          resetTime: quota.resetTime
        },
        backoff: {
          inBackoff: Date.now() < backoff.nextRetryTime,
          nextRetryTime: backoff.nextRetryTime,
          retryCount: backoff.retryCount
        },
        errors: {
          consecutive: client.consecutiveErrors,
          total: client.config.errorCount,
          lastError: client.config.lastError
        },
        lastUsed: client.lastUsed,
        lastActive: client.config.lastActive
      };
    } else {
      // Return status for all channels
      const statuses = [];
      for (const channelId of this.channelClients.keys()) {
        statuses.push(await this.getChannelStatus(channelId));
      }
      return statuses;
    }
  }

  async uploadVideo(filePath, metadata = {}, channelId = null) {
    let selectedChannel;
    
    try {
      // Select optimal channel if not specified
      if (channelId) {
        const client = this.channelClients.get(channelId);
        if (!client) {
          throw new Error(`Channel ${channelId} not found`);
        }
        selectedChannel = { channelId, client };
      } else {
        selectedChannel = await this.getOptimalChannel(200); // Video upload costs ~200 quota
      }

      const result = await this.executeWithQuotaTracking(
        selectedChannel.channelId,
        async (youtube) => {
          const fileSize = (await fs.stat(filePath)).size;
          const media = {
            body: require('fs').createReadStream(filePath)
          };

          const resource = {
            snippet: {
              title: metadata.title || path.basename(filePath, path.extname(filePath)),
              description: metadata.description || 'Automated upload via Multi-Channel Manager',
              tags: metadata.tags || [],
              categoryId: metadata.categoryId || '22',
              defaultLanguage: metadata.language || 'en'
            },
            status: {
              privacyStatus: metadata.privacy || 'private',
              selfDeclaredMadeForKids: false
            }
          };

          const response = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: resource,
            media: media,
            notifySubscribers: false
          });

          return {
            videoId: response.data.id,
            videoUrl: `https://www.youtube.com/watch?v=${response.data.id}`,
            channelId: selectedChannel.channelId,
            channelName: selectedChannel.client.config.name,
            uploadTime: new Date().toISOString()
          };
        },
        200 // Quota cost for video upload
      );

      logger.info(`✅ Video uploaded successfully to channel ${result.channelName}: ${result.videoUrl}`);
      return result;
    } catch (error) {
      logger.error(`❌ Video upload failed:`, error);
      throw error;
    }
  }

  // Utility methods
  async getChannelInfo(channelId) {
    const client = this.channelClients.get(channelId);
    if (!client) {
      throw new Error(`Channel ${channelId} not found`);
    }

    return await this.executeWithQuotaTracking(channelId, async (youtube) => {
      const response = await youtube.channels.list({
        part: ['snippet', 'statistics', 'contentDetails'],
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
        customUrl: channel.snippet.customUrl,
        publishedAt: channel.snippet.publishedAt,
        subscriberCount: parseInt(channel.statistics.subscriberCount || 0),
        videoCount: parseInt(channel.statistics.videoCount || 0),
        viewCount: parseInt(channel.statistics.viewCount || 0)
      };
    }, 1);
  }

  getActiveChannelIds() {
    return Array.from(this.channelClients.keys()).filter(channelId => {
      const client = this.channelClients.get(channelId);
      return client.config.isActive;
    });
  }

  async healthCheck() {
    const channels = await this.getChannelStatus();
    const totalChannels = channels.length;
    const activeChannels = channels.filter(c => c.isActive).length;
    const channelsWithQuota = channels.filter(c => c.quota.remaining > 100).length;
    const channelsInBackoff = channels.filter(c => c.backoff.inBackoff).length;
    const channelsWithErrors = channels.filter(c => c.errors.consecutive > 0).length;

    return {
      status: activeChannels > 0 && channelsWithQuota > 0 ? 'healthy' : 'degraded',
      totalChannels,
      activeChannels,
      channelsWithQuota,
      channelsInBackoff,
      channelsWithErrors,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = MultiChannelManager;
