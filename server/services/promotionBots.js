const axios = require('axios');
const logger = require('../utils/logger');
const { PromotionActivity, Upload, ChannelConfig } = require('../models');

class PromotionBots {
  constructor() {
    this.platforms = {
      reddit: {
        enabled: !!process.env.REDDIT_CLIENT_ID,
        client_id: process.env.REDDIT_CLIENT_ID,
        client_secret: process.env.REDDIT_CLIENT_SECRET,
        username: process.env.REDDIT_USERNAME,
        password: process.env.REDDIT_PASSWORD,
        user_agent: process.env.REDDIT_USER_AGENT || 'YouTubePromoBot/1.0',
        access_token: null,
        token_expiry: null
      },
      telegram: {
        enabled: !!process.env.TELEGRAM_BOT_TOKEN,
        bot_token: process.env.TELEGRAM_BOT_TOKEN,
        channels: JSON.parse(process.env.TELEGRAM_CHANNELS || '[]')
      },
      twitter: {
        enabled: !!process.env.TWITTER_API_KEY,
        api_key: process.env.TWITTER_API_KEY,
        api_secret: process.env.TWITTER_API_SECRET,
        access_token: process.env.TWITTER_ACCESS_TOKEN,
        access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        bearer_token: process.env.TWITTER_BEARER_TOKEN
      }
    };

    this.rateLimits = {
      reddit: { requests: 0, resetTime: Date.now() + 60000, maxRequests: 60 },
      telegram: { requests: 0, resetTime: Date.now() + 60000, maxRequests: 30 },
      twitter: { requests: 0, resetTime: Date.now() + 900000, maxRequests: 300 } // 15 minutes
    };

    this.contentTemplates = {
      reddit: [
        'Check out this {category} content: {title} - {url}',
        'Just uploaded: {title} {url} - What do you think?',
        'New {category}: {title} - {url} - Hope you enjoy!',
        '{title} - {url} - Feedback appreciated!'
      ],
      telegram: [
        '🎵 New Upload: {title}\n\n{description}\n\n👉 {url}',
        '🔥 Fresh Content: {title}\n\nCheck it out: {url}',
        '📺 Just Published: {title}\n\n{url}\n\n#YouTube #{category}',
        '🌟 {title}\n\n{description}\n\nWatch here: {url}'
      ],
      twitter: [
        '🎵 New video is live: {title} {url} #{category}',
        'Just dropped: {title} 🔥 {url} #{category} #viral',
        '{title} - watch here: {url} #{category} #trending',
        '🌟 Fresh content: {title} {url} #{category} #music'
      ]
    };

    this.subredditDatabase = {
      music: ['Music', 'listentothis', 'WeAreTheMusicMakers', 'edmproduction', 'trapproduction'],
      gaming: ['gaming', 'Games', 'GameDev', 'IndieGaming', 'pcmasterrace'],
      tech: ['technology', 'gadgets', 'programming', 'MachineLearning', 'artificial'],
      lifestyle: ['LifeProTips', 'GetMotivated', 'selfimprovement', 'productivity'],
      educational: ['educationalgifs', 'YouShouldKnow', 'todayilearned', 'explainlikeimfive']
    };
  }

  async initialize() {
    try {
      logger.info('📢 Initializing Promotion Bots...');

      // Initialize Reddit authentication
      if (this.platforms.reddit.enabled) {
        await this.initializeReddit();
      }

      // Test Telegram connection
      if (this.platforms.telegram.enabled) {
        await this.testTelegramConnection();
      }

      // Test Twitter connection
      if (this.platforms.twitter.enabled) {
        await this.testTwitterConnection();
      }

      this.startRateLimitResets();

      logger.info('✅ Promotion Bots initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Promotion Bots initialization failed:', error);
      throw error;
    }
  }

  async initializeReddit() {
    try {
      const { client_id, client_secret, username, password, user_agent } = this.platforms.reddit;

      const authString = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
      
      const response = await axios.post('https://www.reddit.com/api/v1/access_token', 
        `grant_type=password&username=${username}&password=${password}`,
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'User-Agent': user_agent,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      this.platforms.reddit.access_token = response.data.access_token;
      this.platforms.reddit.token_expiry = Date.now() + (response.data.expires_in * 1000);

      logger.info('✅ Reddit authentication successful');
    } catch (error) {
      logger.error('❌ Reddit authentication failed:', error);
      this.platforms.reddit.enabled = false;
      throw error;
    }
  }

  async testTelegramConnection() {
    try {
      const response = await axios.get(`https://api.telegram.org/bot${this.platforms.telegram.bot_token}/getMe`, {
        timeout: 5000
      });

      if (response.data.ok) {
        logger.info(`✅ Telegram bot connected: @${response.data.result.username}`);
      } else {
        throw new Error('Telegram API returned error');
      }
    } catch (error) {
      logger.error('❌ Telegram connection failed:', error);
      this.platforms.telegram.enabled = false;
      throw error;
    }
  }

  async testTwitterConnection() {
    try {
      const response = await axios.get('https://api.twitter.com/1.1/account/verify_credentials.json', {
        headers: {
          'Authorization': this.getTwitterAuthHeader('GET', 'https://api.twitter.com/1.1/account/verify_credentials.json')
        },
        timeout: 5000
      });

      logger.info(`✅ Twitter connected: @${response.data.screen_name}`);
    } catch (error) {
      logger.error('❌ Twitter connection failed:', error);
      this.platforms.twitter.enabled = false;
      throw error;
    }
  }

  startRateLimitResets() {
    setInterval(() => {
      const now = Date.now();
      
      Object.keys(this.rateLimits).forEach(platform => {
        const limit = this.rateLimits[platform];
        if (now >= limit.resetTime) {
          limit.requests = 0;
          limit.resetTime = now + (platform === 'twitter' ? 900000 : 60000);
        }
      });
    }, 60000); // Check every minute
  }

  async promoteVideo(upload, channelConfig) {
    try {
      logger.info(`📢 Starting promotion for video: ${upload.title}`);

      const results = [];
      const promotionSettings = channelConfig.promotionSettings;

      // Reddit promotion
      if (this.platforms.reddit.enabled && promotionSettings.reddit.enabled) {
        const redditResults = await this.promoteOnReddit(upload, promotionSettings.reddit);
        results.push(...redditResults);
      }

      // Telegram promotion
      if (this.platforms.telegram.enabled && promotionSettings.telegram.enabled) {
        const telegramResults = await this.promoteOnTelegram(upload, promotionSettings.telegram);
        results.push(...telegramResults);
      }

      // Twitter promotion
      if (this.platforms.twitter.enabled && promotionSettings.twitter.enabled) {
        const twitterResults = await this.promoteOnTwitter(upload, promotionSettings.twitter);
        results.push(...twitterResults);
      }

      logger.info(`✅ Promotion completed for ${upload.title}. ${results.length} activities created`);
      return results;
    } catch (error) {
      logger.error(`❌ Promotion failed for ${upload.title}:`, error);
      throw error;
    }
  }

  async promoteOnReddit(upload, settings) {
    try {
      const activities = [];
      const subreddits = settings.subreddits || this.getRelevantSubreddits(upload.category);

      for (const subreddit of subreddits.slice(0, 3)) { // Limit to 3 subreddits per video
        if (!(await this.checkRateLimit('reddit'))) {
          logger.warn('⚠️ Reddit rate limit reached, skipping remaining posts');
          break;
        }

        // Check subreddit rules first
        const canPost = await this.checkSubredditRules(subreddit, upload);
        if (!canPost) {
          logger.warn(`⚠️ Cannot post to r/${subreddit} - rules violation`);
          continue;
        }

        const content = this.generateContent('reddit', upload);
        
        try {
          const postResult = await this.submitRedditPost(subreddit, content, upload);
          
          const activity = await PromotionActivity.create({
            uploadId: upload.id,
            platform: 'reddit',
            action: 'post',
            target: subreddit,
            content: content.text,
            postId: postResult.id,
            status: 'posted',
            postedAt: new Date(),
            metadata: {
              subreddit: subreddit,
              url: postResult.url,
              permalink: postResult.permalink
            }
          });

          activities.push(activity);
          
          // Add delay between posts
          await this.delay(30000); // 30 seconds between Reddit posts

        } catch (postError) {
          logger.error(`❌ Failed to post to r/${subreddit}:`, postError);
          
          await PromotionActivity.create({
            uploadId: upload.id,
            platform: 'reddit',
            action: 'post',
            target: subreddit,
            content: content.text,
            status: 'failed',
            errorMessage: postError.message
          });
        }
      }

      return activities;
    } catch (error) {
      logger.error('❌ Reddit promotion failed:', error);
      return [];
    }
  }

  async checkSubredditRules(subreddit, upload) {
    try {
      // Get subreddit info
      await this.checkRateLimit('reddit');
      
      const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/about`, {
        headers: {
          'Authorization': `Bearer ${this.platforms.reddit.access_token}`,
          'User-Agent': this.platforms.reddit.user_agent
        },
        timeout: 10000
      });

      const subredditData = response.data.data;
      
      // Basic rule checks
      if (subredditData.over18 && !upload.metadata?.mature) {
        return false; // NSFW subreddit but content isn't marked as mature
      }

      if (subredditData.submission_type === 'link' && !upload.videoUrl) {
        return false; // Link-only subreddit but we don't have a URL
      }

      // Check if self-promotion is allowed (basic heuristic)
      const rules = subredditData.description?.toLowerCase() || '';
      if (rules.includes('no self promotion') || rules.includes('no spam')) {
        return false;
      }

      return true;
    } catch (error) {
      logger.warn(`⚠️ Could not check rules for r/${subreddit}, proceeding cautiously`);
      return true; // Default to allow if we can't check
    }
  }

  async submitRedditPost(subreddit, content, upload) {
    await this.ensureRedditAuth();
    
    const postData = {
      sr: subreddit,
      kind: 'link',
      title: content.title,
      url: upload.videoUrl || `https://www.youtube.com/watch?v=${upload.videoId}`,
      api_type: 'json'
    };

    const response = await axios.post('https://oauth.reddit.com/api/submit', postData, {
      headers: {
        'Authorization': `Bearer ${this.platforms.reddit.access_token}`,
        'User-Agent': this.platforms.reddit.user_agent,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    this.rateLimits.reddit.requests++;

    if (response.data.json.errors.length > 0) {
      throw new Error(`Reddit API Error: ${response.data.json.errors[0]}`);
    }

    const postData_result = response.data.json.data;
    return {
      id: postData_result.id,
      url: postData_result.url,
      permalink: `https://reddit.com${postData_result.permalink}`
    };
  }

  async promoteOnTelegram(upload, settings) {
    try {
      const activities = [];
      const channels = settings.channels || this.platforms.telegram.channels;

      for (const channel of channels) {
        if (!(await this.checkRateLimit('telegram'))) {
          logger.warn('⚠️ Telegram rate limit reached, skipping remaining channels');
          break;
        }

        const content = this.generateContent('telegram', upload);
        
        try {
          const messageResult = await this.sendTelegramMessage(channel, content.text);
          
          const activity = await PromotionActivity.create({
            uploadId: upload.id,
            platform: 'telegram',
            action: 'post',
            target: channel,
            content: content.text,
            postId: messageResult.message_id.toString(),
            status: 'posted',
            postedAt: new Date(),
            metadata: {
              channel: channel,
              chat_id: messageResult.chat.id,
              message_id: messageResult.message_id
            }
          });

          activities.push(activity);
          
          // Add delay between messages
          await this.delay(5000); // 5 seconds between Telegram messages

        } catch (postError) {
          logger.error(`❌ Failed to post to Telegram channel ${channel}:`, postError);
          
          await PromotionActivity.create({
            uploadId: upload.id,
            platform: 'telegram',
            action: 'post',
            target: channel,
            content: content.text,
            status: 'failed',
            errorMessage: postError.message
          });
        }
      }

      return activities;
    } catch (error) {
      logger.error('❌ Telegram promotion failed:', error);
      return [];
    }
  }

  async sendTelegramMessage(chatId, text) {
    const response = await axios.post(
      `https://api.telegram.org/bot${this.platforms.telegram.bot_token}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      },
      { timeout: 10000 }
    );

    this.rateLimits.telegram.requests++;

    if (!response.data.ok) {
      throw new Error(`Telegram API Error: ${response.data.description}`);
    }

    return response.data.result;
  }

  async promoteOnTwitter(upload, settings) {
    try {
      const activities = [];
      
      if (!(await this.checkRateLimit('twitter'))) {
        logger.warn('⚠️ Twitter rate limit reached, skipping promotion');
        return activities;
      }

      const content = this.generateContent('twitter', upload);
      const hashtags = this.generateTwitterHashtags(upload, settings.hashtags);
      const tweetText = `${content.text} ${hashtags}`.trim().substring(0, 280);
      
      try {
        const tweetResult = await this.postTweet(tweetText);
        
        const activity = await PromotionActivity.create({
          uploadId: upload.id,
          platform: 'twitter',
          action: 'post',
          target: 'timeline',
          content: tweetText,
          postId: tweetResult.id_str,
          status: 'posted',
          postedAt: new Date(),
          metadata: {
            tweet_id: tweetResult.id_str,
            tweet_url: `https://twitter.com/user/status/${tweetResult.id_str}`,
            hashtags: hashtags.split(' ')
          }
        });

        activities.push(activity);

      } catch (postError) {
        logger.error('❌ Failed to post tweet:', postError);
        
        await PromotionActivity.create({
          uploadId: upload.id,
          platform: 'twitter',
          action: 'post',
          target: 'timeline',
          content: tweetText,
          status: 'failed',
          errorMessage: postError.message
        });
      }

      return activities;
    } catch (error) {
      logger.error('❌ Twitter promotion failed:', error);
      return [];
    }
  }

  async postTweet(text) {
    const url = 'https://api.twitter.com/1.1/statuses/update.json';
    
    const response = await axios.post(url, 
      `status=${encodeURIComponent(text)}`,
      {
        headers: {
          'Authorization': this.getTwitterAuthHeader('POST', url, { status: text }),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    this.rateLimits.twitter.requests++;
    return response.data;
  }

  getTwitterAuthHeader(method, url, params = {}) {
    const oauth = require('oauth');
    
    const oauth1 = new oauth.OAuth(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      this.platforms.twitter.api_key,
      this.platforms.twitter.api_secret,
      '1.0A',
      null,
      'HMAC-SHA1'
    );

    return oauth1.authHeader(
      url,
      this.platforms.twitter.access_token,
      this.platforms.twitter.access_token_secret,
      method,
      params
    );
  }

  generateContent(platform, upload) {
    const templates = this.contentTemplates[platform];
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    const videoUrl = upload.videoUrl || `https://www.youtube.com/watch?v=${upload.videoId}`;
    
    const content = template
      .replace(/{title}/g, upload.title)
      .replace(/{description}/g, this.truncateDescription(upload.description, platform))
      .replace(/{url}/g, videoUrl)
      .replace(/{category}/g, upload.category || 'content')
      .replace(/{channel}/g, upload.channelName || 'Channel');

    return {
      text: content,
      title: platform === 'reddit' ? this.generateRedditTitle(upload) : content
    };
  }

  generateRedditTitle(upload) {
    // Create engaging Reddit titles
    const prefixes = ['[OC]', '[Original]', 'I made', 'Just finished', 'Check out my'];
    const suffixes = ['- feedback welcome!', '- what do you think?', '- hope you enjoy!'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    let title = `${prefix} ${upload.title} ${suffix}`;
    
    // Ensure title is within Reddit's limits
    return title.length > 300 ? title.substring(0, 297) + '...' : title;
  }

  truncateDescription(description, platform) {
    if (!description) return '';
    
    const limits = {
      reddit: 500,
      telegram: 200,
      twitter: 100
    };
    
    const limit = limits[platform] || 200;
    return description.length > limit ? description.substring(0, limit - 3) + '...' : description;
  }

  generateTwitterHashtags(upload, customHashtags = []) {
    const baseHashtags = customHashtags.slice(0, 3);
    
    // Add category-based hashtags
    const categoryHashtags = this.getCategoryHashtags(upload.category);
    baseHashtags.push(...categoryHashtags.slice(0, 2));
    
    // Add trending hashtags
    const trendingHashtags = ['#viral', '#trending', '#youtube', '#newcontent'];
    baseHashtags.push(trendingHashtags[Math.floor(Math.random() * trendingHashtags.length)]);
    
    return baseHashtags
      .slice(0, 5) // Twitter best practice: max 5 hashtags
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
      .join(' ');
  }

  getCategoryHashtags(category) {
    const categoryHashtags = {
      'music': ['#music', '#musician', '#newmusic', '#audio', '#sound'],
      'gaming': ['#gaming', '#gamer', '#gameplay', '#videogames', '#esports'],
      'tech': ['#tech', '#technology', '#gadgets', '#innovation', '#digital'],
      'lifestyle': ['#lifestyle', '#vlog', '#daily', '#life', '#inspiration'],
      'education': ['#education', '#learning', '#tutorial', '#knowledge', '#tips']
    };
    
    return categoryHashtags[category?.toLowerCase()] || ['#content', '#creative', '#original'];
  }

  getRelevantSubreddits(category) {
    return this.subredditDatabase[category?.toLowerCase()] || ['videos', 'content', 'original'];
  }

  async checkRateLimit(platform) {
    const limit = this.rateLimits[platform];
    const now = Date.now();
    
    // Reset if time window has passed
    if (now >= limit.resetTime) {
      limit.requests = 0;
      limit.resetTime = now + (platform === 'twitter' ? 900000 : 60000);
    }
    
    return limit.requests < limit.maxRequests;
  }

  async ensureRedditAuth() {
    if (!this.platforms.reddit.access_token || 
        Date.now() >= this.platforms.reddit.token_expiry - 60000) { // Refresh 1 minute before expiry
      await this.initializeReddit();
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Engagement tracking and analytics
  async trackEngagement(activityId, engagementData) {
    try {
      const activity = await PromotionActivity.findByPk(activityId);
      if (!activity) return;

      const updatedEngagement = {
        ...activity.engagement,
        ...engagementData,
        lastUpdated: new Date()
      };

      await activity.update({ 
        engagement: updatedEngagement,
        performance: this.calculatePerformance(updatedEngagement)
      });

      return updatedEngagement;
    } catch (error) {
      logger.error('❌ Engagement tracking failed:', error);
    }
  }

  calculatePerformance(engagement) {
    const { views = 0, likes = 0, comments = 0, shares = 0, clicks = 0 } = engagement;
    
    const engagementRate = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;
    const clickThroughRate = views > 0 ? (clicks / views) * 100 : 0;
    
    return {
      engagementRate: Math.round(engagementRate * 100) / 100,
      clickThroughRate: Math.round(clickThroughRate * 100) / 100,
      totalInteractions: likes + comments + shares + clicks,
      score: this.calculateEngagementScore(engagementRate, clickThroughRate, views)
    };
  }

  calculateEngagementScore(engagementRate, clickThroughRate, views) {
    // Simple scoring algorithm
    let score = 0;
    
    // Engagement rate scoring (0-40 points)
    if (engagementRate > 10) score += 40;
    else if (engagementRate > 5) score += 30;
    else if (engagementRate > 2) score += 20;
    else if (engagementRate > 1) score += 10;
    
    // Click-through rate scoring (0-30 points)
    if (clickThroughRate > 5) score += 30;
    else if (clickThroughRate > 3) score += 20;
    else if (clickThroughRate > 1) score += 10;
    
    // View count scoring (0-30 points)
    if (views > 1000) score += 30;
    else if (views > 500) score += 20;
    else if (views > 100) score += 10;
    else if (views > 10) score += 5;
    
    return Math.min(score, 100);
  }

  // Analytics and reporting
  async getPromotionAnalytics(channelId, timeframe = '7d') {
    try {
      const days = parseInt(timeframe.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const activities = await PromotionActivity.findAll({
        include: [{
          model: Upload,
          as: 'upload',
          where: { channelConfigId: channelId }
        }],
        where: {
          createdAt: {
            [require('sequelize').Op.gte]: startDate
          }
        }
      });

      const analytics = {
        totalActivities: activities.length,
        platformBreakdown: {},
        avgEngagement: {},
        topPerformers: [],
        failureRate: {},
        totalReach: 0,
        totalClicks: 0
      };

      // Process analytics by platform
      ['reddit', 'telegram', 'twitter'].forEach(platform => {
        const platformActivities = activities.filter(a => a.platform === platform);
        
        analytics.platformBreakdown[platform] = {
          total: platformActivities.length,
          successful: platformActivities.filter(a => a.status === 'posted').length,
          failed: platformActivities.filter(a => a.status === 'failed').length
        };

        const successfulActivities = platformActivities.filter(a => a.status === 'posted');
        
        if (successfulActivities.length > 0) {
          const totalEngagement = successfulActivities.reduce((sum, a) => {
            const perf = a.performance || {};
            analytics.totalReach += (a.engagement?.views || 0);
            analytics.totalClicks += (a.engagement?.clicks || 0);
            return sum + (perf.engagementRate || 0);
          }, 0);
          
          analytics.avgEngagement[platform] = totalEngagement / successfulActivities.length;
        } else {
          analytics.avgEngagement[platform] = 0;
        }

        analytics.failureRate[platform] = platformActivities.length > 0 
          ? (analytics.platformBreakdown[platform].failed / platformActivities.length) * 100 
          : 0;
      });

      // Find top performers
      analytics.topPerformers = activities
        .filter(a => a.status === 'posted' && a.performance)
        .sort((a, b) => (b.performance.score || 0) - (a.performance.score || 0))
        .slice(0, 10)
        .map(a => ({
          platform: a.platform,
          target: a.target,
          uploadTitle: a.upload?.title,
          score: a.performance.score,
          engagement: a.engagement
        }));

      return analytics;
    } catch (error) {
      logger.error('❌ Promotion analytics failed:', error);
      throw error;
    }
  }

  async schedulePromotion(uploadId, channelId, settings) {
    try {
      const upload = await Upload.findByPk(uploadId);
      const channelConfig = await ChannelConfig.findByPk(channelId);
      
      if (!upload || !channelConfig) {
        throw new Error('Upload or channel not found');
      }

      // Schedule promotion activities
      const scheduledActivities = [];
      const baseDelay = settings.initialDelay || 60000; // 1 minute default

      if (settings.reddit && settings.reddit.enabled) {
        scheduledActivities.push({
          platform: 'reddit',
          scheduledAt: new Date(Date.now() + baseDelay),
          config: settings.reddit
        });
      }

      if (settings.telegram && settings.telegram.enabled) {
        scheduledActivities.push({
          platform: 'telegram',
          scheduledAt: new Date(Date.now() + baseDelay + 300000), // 5 minutes after Reddit
          config: settings.telegram
        });
      }

      if (settings.twitter && settings.twitter.enabled) {
        scheduledActivities.push({
          platform: 'twitter',
          scheduledAt: new Date(Date.now() + baseDelay + 600000), // 10 minutes after Reddit
          config: settings.twitter
        });
      }

      // Create scheduled promotion activities in database
      const activities = [];
      for (const scheduled of scheduledActivities) {
        const activity = await PromotionActivity.create({
          uploadId: upload.id,
          platform: scheduled.platform,
          action: 'post',
          target: 'scheduled',
          status: 'pending',
          scheduledAt: scheduled.scheduledAt,
          metadata: { config: scheduled.config }
        });
        activities.push(activity);
      }

      logger.info(`📅 Scheduled ${activities.length} promotion activities for ${upload.title}`);
      return activities;
    } catch (error) {
      logger.error('❌ Promotion scheduling failed:', error);
      throw error;
    }
  }

  async processScheduledPromotions() {
    try {
      const pendingPromotions = await PromotionActivity.findAll({
        where: {
          status: 'pending',
          scheduledAt: {
            [require('sequelize').Op.lte]: new Date()
          }
        },
        include: [{
          model: Upload,
          as: 'upload',
          include: [{
            model: ChannelConfig,
            as: 'channelConfig'
          }]
        }]
      });

      logger.info(`🔄 Processing ${pendingPromotions.length} scheduled promotions`);

      for (const activity of pendingPromotions) {
        try {
          await activity.update({ status: 'processing' });
          
          const result = await this.executeScheduledPromotion(activity);
          
          await activity.update({
            status: result.success ? 'posted' : 'failed',
            postedAt: result.success ? new Date() : null,
            postId: result.postId || null,
            errorMessage: result.error || null,
            metadata: { ...activity.metadata, result }
          });

        } catch (error) {
          logger.error(`❌ Scheduled promotion failed:`, error);
          await activity.update({
            status: 'failed',
            errorMessage: error.message
          });
        }
      }

      return pendingPromotions.length;
    } catch (error) {
      logger.error('❌ Scheduled promotion processing failed:', error);
      return 0;
    }
  }

  async executeScheduledPromotion(activity) {
    const upload = activity.upload;
    const channelConfig = upload.channelConfig;
    const config = activity.metadata.config;

    try {
      switch (activity.platform) {
        case 'reddit':
          const redditResults = await this.promoteOnReddit(upload, config);
          return { success: redditResults.length > 0, postId: redditResults[0]?.postId };

        case 'telegram':
          const telegramResults = await this.promoteOnTelegram(upload, config);
          return { success: telegramResults.length > 0, postId: telegramResults[0]?.postId };

        case 'twitter':
          const twitterResults = await this.promoteOnTwitter(upload, config);
          return { success: twitterResults.length > 0, postId: twitterResults[0]?.postId };

        default:
          throw new Error(`Unknown platform: ${activity.platform}`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Health check and status
  getHealthStatus() {
    return {
      platforms: {
        reddit: {
          enabled: this.platforms.reddit.enabled,
          authenticated: !!this.platforms.reddit.access_token,
          rateLimitStatus: this.rateLimits.reddit
        },
        telegram: {
          enabled: this.platforms.telegram.enabled,
          rateLimitStatus: this.rateLimits.telegram
        },
        twitter: {
          enabled: this.platforms.twitter.enabled,
          rateLimitStatus: this.rateLimits.twitter
        }
      },
      totalTemplates: Object.keys(this.contentTemplates).length,
      subredditDatabase: Object.keys(this.subredditDatabase).length
    };
  }

  // Content optimization methods
  async optimizeContentForPlatform(content, platform, audience = 'general') {
    // AI-powered content optimization could be added here
    // For now, using rule-based optimization
    
    let optimized = { ...content };
    
    switch (platform) {
      case 'reddit':
        optimized = this.optimizeForReddit(optimized, audience);
        break;
      case 'telegram':
        optimized = this.optimizeForTelegram(optimized);
        break;
      case 'twitter':
        optimized = this.optimizeForTwitter(optimized);
        break;
    }

    return optimized;
  }

  optimizeForReddit(content, audience) {
    // Reddit prefers authentic, conversational tone
    let optimized = { ...content };
    
    // Add personality and authenticity
    if (!optimized.title.includes('I made') && !optimized.title.includes('[OC]')) {
      optimized.title = `[OC] ${optimized.title}`;
    }
    
    // Add engaging elements
    const engagingWords = ['Thoughts?', 'Feedback welcome!', 'What do you think?'];
    const randomEngaging = engagingWords[Math.floor(Math.random() * engagingWords.length)];
    
    if (!optimized.text.includes('?')) {
      optimized.text += ` ${randomEngaging}`;
    }
    
    return optimized;
  }

  optimizeForTelegram(content) {
    // Telegram allows rich formatting and emojis
    let optimized = { ...content };
    
    // Add emojis for visual appeal
    if (!optimized.text.includes('🎵') && !optimized.text.includes('🔥')) {
      optimized.text = `🎵 ${optimized.text}`;
    }
    
    // Use Telegram formatting
    optimized.text = optimized.text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); // Bold
    optimized.text = optimized.text.replace(/\*(.+?)\*/g, '<i>$1</i>'); // Italic
    
    return optimized;
  }

  optimizeForTwitter(content) {
    // Twitter needs concise, hashtag-rich content
    let optimized = { ...content };
    
    // Ensure content fits in character limit
    if (optimized.text.length > 240) { // Leave room for hashtags
      optimized.text = optimized.text.substring(0, 237) + '...';
    }
    
    // Add engaging elements for Twitter
    const twitterElements = ['🔥', '💯', '🚀', '✨'];
    const randomElement = twitterElements[Math.floor(Math.random() * twitterElements.length)];
    
    if (!optimized.text.includes(randomElement)) {
      optimized.text = `${optimized.text} ${randomElement}`;
    }
    
    return optimized;
  }
}

module.exports = PromotionBots;
