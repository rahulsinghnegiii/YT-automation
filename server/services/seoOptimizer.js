const axios = require('axios');
const logger = require('../utils/logger');
const { ChannelConfig, Upload, Asset } = require('../models');

class SEOOptimizer {
  constructor() {
    this.keywordAPIs = {
      ubersuggest: process.env.UBERSUGGEST_API_KEY,
      serpapi: process.env.SERPAPI_KEY,
      keywords_everywhere: process.env.KEYWORDS_EVERYWHERE_API_KEY
    };
    
    this.abTestCache = new Map();
    this.trendingCache = new Map();
    this.competitorCache = new Map();
    this.performanceCache = new Map();
  }

  async initialize() {
    try {
      logger.info('🎯 Initializing SEO Optimizer...');
      
      // Validate API keys
      this.validateAPIKeys();
      
      // Load existing A/B tests
      await this.loadActiveABTests();
      
      logger.info('✅ SEO Optimizer initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ SEO Optimizer initialization failed:', error);
      throw error;
    }
  }

  validateAPIKeys() {
    const missingKeys = [];
    
    Object.entries(this.keywordAPIs).forEach(([service, key]) => {
      if (!key) {
        missingKeys.push(service);
      }
    });

    if (missingKeys.length > 0) {
      logger.warn(`⚠️ Missing API keys for: ${missingKeys.join(', ')}`);
      logger.warn('SEO features will be limited without these keys');
    } else {
      logger.info('✅ All SEO API keys configured');
    }
  }

  async loadActiveABTests() {
    try {
      // Load from database or cache
      const activeTests = await Upload.findAll({
        where: { 
          status: 'published',
          createdAt: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        include: [{ model: Asset, as: 'asset' }]
      });

      // Process A/B test data
      for (const upload of activeTests) {
        if (upload.metadata?.abTest) {
          this.abTestCache.set(upload.videoId, {
            testId: upload.metadata.abTest.testId,
            variant: upload.metadata.abTest.variant,
            metrics: {
              views: upload.viewCount || 0,
              likes: upload.likeCount || 0,
              comments: upload.commentCount || 0,
              ctr: upload.metadata.analytics?.clickThroughRate || 0,
              retention: upload.metadata.analytics?.averageViewPercentage || 0
            }
          });
        }
      }

      logger.info(`📊 Loaded ${this.abTestCache.size} active A/B tests`);
    } catch (error) {
      logger.error('❌ Failed to load A/B tests:', error);
    }
  }

  async optimizeVideoMetadata(videoData, channelConfig) {
    try {
      logger.info(`🎯 Starting SEO optimization for: ${videoData.title}`);

      const optimized = {
        ...videoData,
        seoScore: 0,
        optimization: {
          keywords: [],
          competitors: [],
          trends: [],
          abTest: null,
          recommendations: []
        }
      };

      // 1. Keyword Research & Optimization
      const keywordData = await this.performKeywordResearch(videoData.title, videoData.description);
      optimized.optimization.keywords = keywordData;

      // 2. Competitor Analysis
      const competitorData = await this.analyzeCompetitors(keywordData.primary, channelConfig);
      optimized.optimization.competitors = competitorData;

      // 3. Trending Keywords Analysis  
      const trendingData = await this.analyzeTrendingKeywords(videoData.category);
      optimized.optimization.trends = trendingData;

      // 4. A/B Test Setup
      if (channelConfig.seoSettings.abTestEnabled) {
        const abTestData = await this.createABTest(optimized, keywordData, trendingData);
        optimized.optimization.abTest = abTestData;
      }

      // 5. Generate Optimized Variants
      const variants = await this.generateOptimizedVariants(optimized);
      
      // 6. Calculate SEO Score
      optimized.seoScore = this.calculateSEOScore(optimized);

      // 7. Generate Recommendations
      optimized.optimization.recommendations = this.generateRecommendations(optimized);

      logger.info(`✅ SEO optimization completed. Score: ${optimized.seoScore}/100`);
      return variants;
    } catch (error) {
      logger.error('❌ SEO optimization failed:', error);
      throw error;
    }
  }

  async performKeywordResearch(title, description) {
    try {
      const text = `${title} ${description}`.toLowerCase();
      const keywords = {
        primary: [],
        secondary: [],
        longtail: [],
        trending: [],
        difficulty: {},
        searchVolume: {},
        competition: {}
      };

      // Extract initial keywords
      const extractedKeywords = this.extractKeywords(text);

      // Get keyword metrics from multiple sources
      if (this.keywordAPIs.serpapi) {
        const serpData = await this.getSerpApiKeywords(extractedKeywords);
        this.mergeKeywordData(keywords, serpData);
      }

      if (this.keywordAPIs.ubersuggest) {
        const ubersuggestData = await this.getUbersuggestKeywords(extractedKeywords);
        this.mergeKeywordData(keywords, ubersuggestData);
      }

      // Classify keywords by importance
      keywords.primary = extractedKeywords.slice(0, 3);
      keywords.secondary = extractedKeywords.slice(3, 8);
      keywords.longtail = this.generateLongTailKeywords(extractedKeywords);

      // Get trending variations
      keywords.trending = await this.getTrendingVariations(keywords.primary);

      logger.info(`🔍 Found ${extractedKeywords.length} keywords, ${keywords.trending.length} trending`);
      return keywords;
    } catch (error) {
      logger.error('❌ Keyword research failed:', error);
      return { primary: [], secondary: [], longtail: [], trending: [] };
    }
  }

  extractKeywords(text) {
    // Simple keyword extraction - could be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Remove common stop words
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should']);
    
    const filtered = words.filter(word => !stopWords.has(word));
    
    // Count frequency and return top keywords
    const frequency = {};
    filtered.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  async getSerpApiKeywords(keywords) {
    try {
      const results = { suggestions: [], trends: [], difficulty: {} };
      
      for (const keyword of keywords.slice(0, 5)) { // Limit API calls
        const response = await axios.get('https://serpapi.com/search.json', {
          params: {
            engine: 'google',
            q: keyword,
            api_key: this.keywordAPIs.serpapi,
            num: 10
          },
          timeout: 10000
        });

        if (response.data.related_searches) {
          const suggestions = response.data.related_searches
            .map(item => item.query)
            .slice(0, 5);
          results.suggestions.push(...suggestions);
        }

        // Estimate difficulty based on results count
        if (response.data.search_information) {
          const resultCount = response.data.search_information.total_results;
          results.difficulty[keyword] = this.calculateKeywordDifficulty(resultCount);
        }
      }

      return results;
    } catch (error) {
      logger.error('❌ SerpApi request failed:', error);
      return { suggestions: [], trends: [], difficulty: {} };
    }
  }

  async getUbersuggestKeywords(keywords) {
    try {
      const results = { suggestions: [], volume: {}, difficulty: {} };
      
      // Ubersuggest API implementation
      // Note: This is a placeholder as Ubersuggest has strict API access
      
      return results;
    } catch (error) {
      logger.error('❌ Ubersuggest request failed:', error);
      return { suggestions: [], volume: {}, difficulty: {} };
    }
  }

  calculateKeywordDifficulty(resultCount) {
    // Simple difficulty calculation based on result count
    if (resultCount > 100000000) return 90; // Very high
    if (resultCount > 10000000) return 80;  // High  
    if (resultCount > 1000000) return 60;   // Medium-High
    if (resultCount > 100000) return 40;    // Medium
    if (resultCount > 10000) return 20;     // Low-Medium
    return 10; // Low
  }

  mergeKeywordData(keywords, newData) {
    if (newData.suggestions) {
      keywords.secondary.push(...newData.suggestions.slice(0, 5));
    }
    if (newData.volume) {
      Object.assign(keywords.searchVolume, newData.volume);
    }
    if (newData.difficulty) {
      Object.assign(keywords.difficulty, newData.difficulty);
    }
  }

  generateLongTailKeywords(keywords) {
    const longtail = [];
    const modifiers = ['how to', 'best', 'top', 'guide', 'tutorial', 'tips', 'review', 'vs', '2024', '2025'];
    
    keywords.slice(0, 5).forEach(keyword => {
      modifiers.forEach(modifier => {
        longtail.push(`${modifier} ${keyword}`);
        longtail.push(`${keyword} ${modifier}`);
      });
    });

    return longtail.slice(0, 20);
  }

  async getTrendingVariations(keywords) {
    try {
      const trending = [];
      const currentDate = new Date();
      const timeModifiers = [
        currentDate.getFullYear().toString(),
        `${currentDate.getFullYear()} guide`,
        'latest',
        'new',
        'updated'
      ];

      keywords.forEach(keyword => {
        timeModifiers.forEach(modifier => {
          trending.push(`${keyword} ${modifier}`);
        });
      });

      return trending.slice(0, 10);
    } catch (error) {
      logger.error('❌ Trending variations failed:', error);
      return [];
    }
  }

  async analyzeCompetitors(keywords, channelConfig) {
    try {
      const competitorChannels = channelConfig.seoSettings.competitorChannels || [];
      const analysis = {
        channels: [],
        topPerformers: [],
        gapOpportunities: [],
        benchmarks: {}
      };

      for (const competitorId of competitorChannels) {
        const competitorData = await this.analyzeCompetitorChannel(competitorId, keywords);
        analysis.channels.push(competitorData);
      }

      // Find top performers
      analysis.topPerformers = await this.findTopPerformingVideos(keywords);
      
      // Identify content gaps
      analysis.gapOpportunities = await this.identifyContentGaps(keywords, analysis.channels);

      // Calculate benchmarks
      analysis.benchmarks = this.calculateCompetitorBenchmarks(analysis.channels);

      return analysis;
    } catch (error) {
      logger.error('❌ Competitor analysis failed:', error);
      return { channels: [], topPerformers: [], gapOpportunities: [], benchmarks: {} };
    }
  }

  async analyzeCompetitorChannel(channelId, keywords) {
    try {
      // This would use YouTube Data API to analyze competitor
      const analysis = {
        channelId,
        name: 'Competitor Channel',
        metrics: {
          subscribers: 0,
          avgViews: 0,
          uploadFrequency: 0,
          engagementRate: 0
        },
        topKeywords: [],
        contentStrategy: {
          titlePatterns: [],
          descriptionLength: 0,
          tagsUsage: []
        }
      };

      // Placeholder for actual API implementation
      return analysis;
    } catch (error) {
      logger.error(`❌ Competitor ${channelId} analysis failed:`, error);
      return null;
    }
  }

  async findTopPerformingVideos(keywords) {
    try {
      const topVideos = [];
      
      // Search for top-performing videos with these keywords
      for (const keyword of keywords.slice(0, 3)) {
        if (this.keywordAPIs.serpapi) {
          const response = await axios.get('https://serpapi.com/search.json', {
            params: {
              engine: 'youtube',
              search_query: keyword,
              api_key: this.keywordAPIs.serpapi
            },
            timeout: 10000
          });

          if (response.data.video_results) {
            const videos = response.data.video_results.slice(0, 5).map(video => ({
              title: video.title,
              channel: video.channel,
              views: video.views,
              duration: video.duration,
              published: video.published_date,
              keyword: keyword
            }));
            
            topVideos.push(...videos);
          }
        }
      }

      return topVideos.slice(0, 15);
    } catch (error) {
      logger.error('❌ Top performers analysis failed:', error);
      return [];
    }
  }

  identifyContentGaps(keywords, competitors) {
    const gaps = [];
    const competitorKeywords = new Set();
    
    // Collect all competitor keywords
    competitors.forEach(comp => {
      if (comp && comp.topKeywords) {
        comp.topKeywords.forEach(kw => competitorKeywords.add(kw));
      }
    });

    // Find keywords not heavily used by competitors
    keywords.forEach(keyword => {
      if (!competitorKeywords.has(keyword)) {
        gaps.push({
          keyword,
          difficulty: 'Low',
          opportunity: 'High',
          reason: 'Underutilized by competitors'
        });
      }
    });

    return gaps.slice(0, 10);
  }

  calculateCompetitorBenchmarks(competitors) {
    if (competitors.length === 0) return {};

    const validCompetitors = competitors.filter(c => c && c.metrics);
    if (validCompetitors.length === 0) return {};

    const totals = validCompetitors.reduce((acc, comp) => ({
      avgViews: acc.avgViews + (comp.metrics.avgViews || 0),
      engagementRate: acc.engagementRate + (comp.metrics.engagementRate || 0),
      uploadFrequency: acc.uploadFrequency + (comp.metrics.uploadFrequency || 0)
    }), { avgViews: 0, engagementRate: 0, uploadFrequency: 0 });

    const count = validCompetitors.length;
    return {
      avgViews: Math.round(totals.avgViews / count),
      engagementRate: Math.round((totals.engagementRate / count) * 100) / 100,
      uploadFrequency: Math.round((totals.uploadFrequency / count) * 100) / 100,
      competitorCount: count
    };
  }

  async analyzeTrendingKeywords(category) {
    try {
      const trending = {
        keywords: [],
        hashtags: [],
        topics: [],
        seasonal: [],
        viral: []
      };

      // Get trending keywords for category
      if (this.keywordAPIs.serpapi) {
        const response = await axios.get('https://serpapi.com/search.json', {
          params: {
            engine: 'google_trends',
            q: category,
            api_key: this.keywordAPIs.serpapi,
            data_type: 'TIMESERIES'
          },
          timeout: 10000
        });

        if (response.data.interest_over_time) {
          trending.keywords = response.data.related_queries?.rising || [];
        }
      }

      // Add seasonal keywords based on current date
      trending.seasonal = this.getSeasonalKeywords();
      
      // Get viral hashtags (mock data for now)
      trending.hashtags = this.getTrendingHashtags(category);

      return trending;
    } catch (error) {
      logger.error('❌ Trending analysis failed:', error);
      return { keywords: [], hashtags: [], topics: [], seasonal: [], viral: [] };
    }
  }

  getSeasonalKeywords() {
    const month = new Date().getMonth();
    const seasonal = {
      0: ['new year', 'resolution', 'january'],
      1: ['valentine', 'february', 'love'],
      2: ['spring', 'march', 'easter'],
      3: ['april', 'spring', 'easter'],
      4: ['may', 'mother day', 'spring'],
      5: ['june', 'summer', 'father day'],
      6: ['july', 'summer', 'vacation'],
      7: ['august', 'summer', 'back to school'],
      8: ['september', 'fall', 'autumn'],
      9: ['october', 'halloween', 'fall'],
      10: ['november', 'thanksgiving', 'black friday'],
      11: ['december', 'christmas', 'holiday', 'new year']
    };

    return seasonal[month] || [];
  }

  getTrendingHashtags(category) {
    // Mock trending hashtags - would integrate with social media APIs
    const hashtags = {
      'music': ['#music', '#trending', '#viral', '#newmusic', '#musician'],
      'gaming': ['#gaming', '#gamer', '#gameplay', '#streamer', '#esports'],
      'tech': ['#tech', '#technology', '#gadgets', '#review', '#innovation'],
      'lifestyle': ['#lifestyle', '#vlog', '#daily', '#inspiration', '#motivation'],
      'education': ['#education', '#learning', '#tutorial', '#howto', '#tips']
    };

    return hashtags[category.toLowerCase()] || ['#trending', '#viral', '#popular'];
  }

  async createABTest(videoData, keywordData, trendingData) {
    try {
      const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const variants = [
        {
          variant: 'A',
          title: videoData.title, // Original
          description: videoData.description,
          tags: videoData.tags || []
        },
        {
          variant: 'B',
          title: this.optimizeTitle(videoData.title, keywordData, 'keyword_focus'),
          description: this.optimizeDescription(videoData.description, keywordData),
          tags: this.optimizeTags(videoData.tags, keywordData, trendingData)
        },
        {
          variant: 'C',
          title: this.optimizeTitle(videoData.title, trendingData, 'trending_focus'),
          description: this.optimizeDescription(videoData.description, trendingData),
          tags: this.optimizeTags(videoData.tags, keywordData, trendingData)
        }
      ];

      const abTest = {
        testId,
        status: 'active',
        startDate: new Date(),
        duration: 7, // days
        variants,
        metrics: {
          impressions: {},
          clicks: {},
          views: {},
          engagement: {}
        },
        winner: null,
        confidence: 0
      };

      // Store test for tracking
      this.abTestCache.set(testId, abTest);

      logger.info(`🧪 Created A/B test ${testId} with ${variants.length} variants`);
      return abTest;
    } catch (error) {
      logger.error('❌ A/B test creation failed:', error);
      return null;
    }
  }

  optimizeTitle(originalTitle, keywordData, strategy = 'keyword_focus') {
    try {
      const keywords = keywordData.primary || keywordData.keywords || [];
      if (keywords.length === 0) return originalTitle;

      const primaryKeyword = keywords[0];
      let optimized = originalTitle;

      switch (strategy) {
        case 'keyword_focus':
          // Place primary keyword at the beginning if not already there
          if (!optimized.toLowerCase().includes(primaryKeyword.toLowerCase())) {
            optimized = `${primaryKeyword} - ${optimized}`;
          }
          break;
          
        case 'trending_focus':
          // Add trending modifiers
          const year = new Date().getFullYear();
          if (!optimized.includes(year.toString())) {
            optimized = `${optimized} ${year}`;
          }
          break;
          
        case 'clickbait_focus':
          // Add engaging modifiers
          const modifiers = ['Ultimate Guide', 'Secret', 'Revealed', 'You Need to Know'];
          const randomModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
          optimized = `${randomModifier}: ${optimized}`;
          break;
      }

      // Ensure title is within YouTube's character limit
      return optimized.length > 100 ? optimized.substr(0, 97) + '...' : optimized;
    } catch (error) {
      logger.error('❌ Title optimization failed:', error);
      return originalTitle;
    }
  }

  optimizeDescription(originalDescription, keywordData) {
    try {
      let optimized = originalDescription || '';
      const keywords = keywordData.primary || keywordData.keywords || [];
      
      if (keywords.length === 0) return optimized;

      // Add keywords naturally to description
      const keywordText = `Key topics covered: ${keywords.slice(0, 5).join(', ')}\n\n`;
      
      if (!optimized.includes(keywordText)) {
        optimized = keywordText + optimized;
      }

      // Add call-to-action
      const cta = '\n\n👍 Like this video if it helped you!\n📢 Subscribe for more content!\n💬 Comment your thoughts below!';
      if (!optimized.includes(cta)) {
        optimized += cta;
      }

      return optimized;
    } catch (error) {
      logger.error('❌ Description optimization failed:', error);
      return originalDescription;
    }
  }

  optimizeTags(originalTags = [], keywordData, trendingData) {
    try {
      const optimized = new Set(originalTags);
      
      // Add primary keywords
      (keywordData.primary || []).forEach(keyword => optimized.add(keyword));
      
      // Add secondary keywords  
      (keywordData.secondary || []).slice(0, 5).forEach(keyword => optimized.add(keyword));
      
      // Add trending keywords
      (trendingData.keywords || []).slice(0, 3).forEach(keyword => optimized.add(keyword));
      
      // Add trending hashtags (remove # for tags)
      (trendingData.hashtags || []).slice(0, 3).forEach(hashtag => {
        optimized.add(hashtag.replace('#', ''));
      });

      return Array.from(optimized).slice(0, 30); // YouTube allows up to 30 tags
    } catch (error) {
      logger.error('❌ Tags optimization failed:', error);
      return originalTags;
    }
  }

  async generateOptimizedVariants(videoData) {
    try {
      const variants = [];
      
      // Generate different optimization strategies
      const strategies = [
        { name: 'Keyword Optimized', focus: 'keywords' },
        { name: 'Trending Optimized', focus: 'trending' },
        { name: 'Engagement Optimized', focus: 'engagement' },
        { name: 'Competitor Optimized', focus: 'competitor' }
      ];

      for (const strategy of strategies) {
        const variant = {
          name: strategy.name,
          strategy: strategy.focus,
          title: this.optimizeForStrategy(videoData.title, videoData.optimization, strategy.focus, 'title'),
          description: this.optimizeForStrategy(videoData.description, videoData.optimization, strategy.focus, 'description'),
          tags: this.optimizeForStrategy(videoData.tags, videoData.optimization, strategy.focus, 'tags'),
          seoScore: 0
        };

        variant.seoScore = this.calculateVariantScore(variant, videoData.optimization);
        variants.push(variant);
      }

      // Sort by SEO score
      variants.sort((a, b) => b.seoScore - a.seoScore);

      return variants;
    } catch (error) {
      logger.error('❌ Variant generation failed:', error);
      return [videoData];
    }
  }

  optimizeForStrategy(content, optimization, strategy, type) {
    switch (strategy) {
      case 'keywords':
        return type === 'title' 
          ? this.optimizeTitle(content, optimization.keywords, 'keyword_focus')
          : type === 'description'
          ? this.optimizeDescription(content, optimization.keywords)
          : this.optimizeTags(content, optimization.keywords, {});
          
      case 'trending':
        return type === 'title'
          ? this.optimizeTitle(content, optimization.trends, 'trending_focus')
          : type === 'description'
          ? this.optimizeDescription(content, optimization.trends)
          : this.optimizeTags(content, {}, optimization.trends);
          
      case 'engagement':
        return type === 'title'
          ? this.optimizeTitle(content, optimization.keywords, 'clickbait_focus')
          : content;
          
      case 'competitor':
        // Use competitor insights for optimization
        return content;
        
      default:
        return content;
    }
  }

  calculateSEOScore(videoData) {
    let score = 0;
    const max = 100;
    
    try {
      const optimization = videoData.optimization || {};
      
      // Title optimization (25 points)
      if (videoData.title) {
        score += 10; // Has title
        if (videoData.title.length >= 30 && videoData.title.length <= 100) score += 5;
        if (optimization.keywords?.primary?.some(kw => videoData.title.toLowerCase().includes(kw.toLowerCase()))) score += 10;
      }
      
      // Description optimization (20 points)  
      if (videoData.description) {
        score += 5; // Has description
        if (videoData.description.length >= 100) score += 5;
        if (videoData.description.length >= 500) score += 5;
        if (optimization.keywords?.primary?.some(kw => videoData.description.toLowerCase().includes(kw.toLowerCase()))) score += 5;
      }
      
      // Tags optimization (15 points)
      if (videoData.tags?.length > 0) {
        score += 5;
        if (videoData.tags.length >= 10) score += 5;
        if (optimization.keywords?.primary?.some(kw => videoData.tags.some(tag => tag.toLowerCase().includes(kw.toLowerCase())))) score += 5;
      }
      
      // Keyword research quality (20 points)
      if (optimization.keywords?.primary?.length > 0) score += 10;
      if (optimization.keywords?.secondary?.length > 0) score += 5;
      if (optimization.keywords?.longtail?.length > 0) score += 5;
      
      // Trending analysis (10 points)
      if (optimization.trends?.keywords?.length > 0) score += 5;
      if (optimization.trends?.hashtags?.length > 0) score += 5;
      
      // Competitor analysis (10 points)
      if (optimization.competitors?.channels?.length > 0) score += 5;
      if (optimization.competitors?.gapOpportunities?.length > 0) score += 5;
      
      return Math.min(score, max);
    } catch (error) {
      logger.error('❌ SEO score calculation failed:', error);
      return 0;
    }
  }

  calculateVariantScore(variant, optimization) {
    // Similar to calculateSEOScore but for variants
    let score = this.calculateSEOScore(variant);
    
    // Add bonus points for strategy-specific optimization
    if (variant.strategy === 'keywords' && optimization.keywords?.primary?.length > 0) score += 5;
    if (variant.strategy === 'trending' && optimization.trends?.keywords?.length > 0) score += 5;
    if (variant.strategy === 'competitor' && optimization.competitors?.gapOpportunities?.length > 0) score += 5;
    
    return Math.min(score, 100);
  }

  generateRecommendations(videoData) {
    const recommendations = [];
    const optimization = videoData.optimization || {};
    
    try {
      // Title recommendations
      if (!videoData.title || videoData.title.length < 30) {
        recommendations.push({
          type: 'title',
          priority: 'high',
          message: 'Title should be 30-100 characters for optimal SEO',
          action: 'Expand title with relevant keywords'
        });
      }
      
      // Keyword recommendations
      if (!optimization.keywords?.primary?.length) {
        recommendations.push({
          type: 'keywords',
          priority: 'high', 
          message: 'No primary keywords identified',
          action: 'Conduct keyword research and optimize content'
        });
      }
      
      // Description recommendations
      if (!videoData.description || videoData.description.length < 100) {
        recommendations.push({
          type: 'description',
          priority: 'medium',
          message: 'Description should be at least 100 characters',
          action: 'Add detailed description with keywords'
        });
      }
      
      // Tags recommendations
      if (!videoData.tags?.length || videoData.tags.length < 5) {
        recommendations.push({
          type: 'tags',
          priority: 'medium',
          message: 'Add more relevant tags for better discoverability',
          action: 'Include 10-15 relevant tags'
        });
      }
      
      // Trending recommendations
      if (optimization.trends?.keywords?.length > 0) {
        recommendations.push({
          type: 'trending',
          priority: 'low',
          message: `Consider using trending keywords: ${optimization.trends.keywords.slice(0, 3).join(', ')}`,
          action: 'Incorporate trending terms naturally'
        });
      }
      
      // Competitor recommendations
      if (optimization.competitors?.gapOpportunities?.length > 0) {
        recommendations.push({
          type: 'opportunity',
          priority: 'medium',
          message: `Found ${optimization.competitors.gapOpportunities.length} content gap opportunities`,
          action: 'Focus on underutilized keywords with high potential'
        });
      }
      
      return recommendations;
    } catch (error) {
      logger.error('❌ Recommendations generation failed:', error);
      return [];
    }
  }

  // A/B Testing Methods
  async updateABTestResults(testId, videoId, metrics) {
    try {
      const test = this.abTestCache.get(testId);
      if (!test) return;

      // Update metrics for the variant
      const variant = test.variants.find(v => v.videoId === videoId)?.variant;
      if (variant) {
        test.metrics.views[variant] = metrics.views || 0;
        test.metrics.impressions[variant] = metrics.impressions || 0;
        test.metrics.clicks[variant] = metrics.clicks || 0;
        test.metrics.engagement[variant] = metrics.engagement || 0;
      }

      // Check if test is ready for analysis
      if (this.isABTestComplete(test)) {
        await this.analyzeABTestResults(test);
      }

    } catch (error) {
      logger.error('❌ A/B test update failed:', error);
    }
  }

  isABTestComplete(test) {
    const now = new Date();
    const endDate = new Date(test.startDate);
    endDate.setDate(endDate.getDate() + test.duration);

    // Test is complete if duration passed and all variants have data
    return now >= endDate && 
           Object.keys(test.metrics.views).length === test.variants.length;
  }

  async analyzeABTestResults(test) {
    try {
      const results = [];
      
      for (const variant of test.variants) {
        const metrics = {
          variant: variant.variant,
          views: test.metrics.views[variant.variant] || 0,
          impressions: test.metrics.impressions[variant.variant] || 0,
          clicks: test.metrics.clicks[variant.variant] || 0,
          engagement: test.metrics.engagement[variant.variant] || 0
        };
        
        metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        metrics.engagementRate = metrics.views > 0 ? (metrics.engagement / metrics.views) * 100 : 0;
        
        results.push(metrics);
      }

      // Determine winner
      const winner = results.reduce((prev, current) => 
        (current.views * current.engagementRate) > (prev.views * prev.engagementRate) ? current : prev
      );

      test.winner = winner.variant;
      test.confidence = this.calculateStatisticalSignificance(results);
      test.status = 'completed';

      logger.info(`🏆 A/B test ${test.testId} completed. Winner: Variant ${winner.variant} (${Math.round(test.confidence)}% confidence)`);

      return {
        testId: test.testId,
        winner: winner.variant,
        confidence: test.confidence,
        results
      };
    } catch (error) {
      logger.error('❌ A/B test analysis failed:', error);
      return null;
    }
  }

  calculateStatisticalSignificance(results) {
    // Simplified statistical significance calculation
    // In production, use proper statistical tests
    if (results.length < 2) return 0;

    const sorted = results.sort((a, b) => b.views - a.views);
    const winner = sorted[0];
    const runnerUp = sorted[1];

    if (runnerUp.views === 0) return 100;

    const improvement = ((winner.views - runnerUp.views) / runnerUp.views) * 100;
    
    // Simple confidence based on improvement percentage
    if (improvement > 20) return 95;
    if (improvement > 10) return 85;
    if (improvement > 5) return 70;
    return 50;
  }

  // Refresh existing video metadata
  async refreshVideoMetadata(videoId, channelConfig) {
    try {
      logger.info(`🔄 Refreshing metadata for video: ${videoId}`);

      // Get current video data
      const upload = await Upload.findOne({ 
        where: { videoId },
        include: [{ model: Asset, as: 'asset' }]
      });

      if (!upload) {
        throw new Error(`Video ${videoId} not found`);
      }

      // Get current performance metrics
      const currentMetrics = {
        views: upload.viewCount || 0,
        likes: upload.likeCount || 0,
        comments: upload.commentCount || 0
      };

      // Only refresh if performance is below threshold
      const shouldRefresh = this.shouldRefreshMetadata(currentMetrics, upload.createdAt);
      
      if (shouldRefresh) {
        const optimized = await this.optimizeVideoMetadata({
          title: upload.title,
          description: upload.description,
          tags: upload.tags || [],
          category: upload.category
        }, channelConfig);

        // Update with best performing variant
        const bestVariant = optimized[0];
        
        // Update video metadata via YouTube API
        const multiChannelManager = require('./multiChannelManager');
        await this.updateVideoMetadata(videoId, bestVariant, channelConfig.channelId);

        logger.info(`✅ Refreshed metadata for video ${videoId}`);
        return bestVariant;
      } else {
        logger.info(`ℹ️ Video ${videoId} performing well, skipping refresh`);
        return null;
      }
    } catch (error) {
      logger.error(`❌ Metadata refresh failed for video ${videoId}:`, error);
      throw error;
    }
  }

  shouldRefreshMetadata(metrics, publishDate) {
    const daysSincePublished = Math.floor((Date.now() - new Date(publishDate).getTime()) / (1000 * 60 * 60 * 24));
    
    // Don't refresh very new videos
    if (daysSincePublished < 7) return false;
    
    // Refresh if performance is poor
    const expectedViews = this.calculateExpectedViews(daysSincePublished);
    const performanceRatio = metrics.views / expectedViews;
    
    return performanceRatio < 0.5; // Refresh if less than 50% of expected performance
  }

  calculateExpectedViews(daysSincePublished) {
    // Simple expected views calculation
    // In production, this would be based on channel analytics
    const baseViews = 100;
    const growthFactor = Math.log(daysSincePublished + 1);
    return baseViews * growthFactor;
  }

  async updateVideoMetadata(videoId, optimizedData, channelId) {
    try {
      const MultiChannelManager = require('./multiChannelManager');
      const manager = new MultiChannelManager();
      
      const client = manager.channelClients.get(channelId);
      if (!client) {
        throw new Error(`Channel ${channelId} not available`);
      }

      await manager.executeWithQuotaTracking(channelId, async (youtube) => {
        await youtube.videos.update({
          part: ['snippet'],
          requestBody: {
            id: videoId,
            snippet: {
              title: optimizedData.title,
              description: optimizedData.description,
              tags: optimizedData.tags,
              categoryId: optimizedData.categoryId || '22'
            }
          }
        });
      }, 50); // Quota cost for video update

      return true;
    } catch (error) {
      logger.error(`❌ Video metadata update failed for ${videoId}:`, error);
      throw error;
    }
  }

  // Utility methods
  async getOptimizationReport(channelId) {
    try {
      const uploads = await Upload.findAll({
        where: { channelConfigId: channelId },
        order: [['createdAt', 'DESC']],
        limit: 50
      });

      const report = {
        channelId,
        totalVideos: uploads.length,
        avgSEOScore: 0,
        topPerformers: [],
        needsOptimization: [],
        trends: {
          views: [],
          engagement: []
        }
      };

      // Calculate average SEO score
      const scores = uploads.map(u => u.metadata?.seoScore || 0);
      report.avgSEOScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Find top and bottom performers
      uploads.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      report.topPerformers = uploads.slice(0, 5);
      report.needsOptimization = uploads.filter(u => (u.metadata?.seoScore || 0) < 50).slice(0, 10);

      return report;
    } catch (error) {
      logger.error('❌ Optimization report failed:', error);
      throw error;
    }
  }

  getHealthStatus() {
    return {
      status: 'active',
      apiKeys: Object.keys(this.keywordAPIs).filter(key => this.keywordAPIs[key]),
      activeABTests: this.abTestCache.size,
      cacheSize: {
        abTests: this.abTestCache.size,
        trending: this.trendingCache.size,
        competitors: this.competitorCache.size
      }
    };
  }
}

module.exports = SEOOptimizer;
