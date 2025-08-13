const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChannelConfig = sequelize.define('ChannelConfig', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    channelId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    apiKeyId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    clientSecret: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    quotaUsed: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    quotaLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 10000
    },
    quotaResetTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    uploadSettings: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        privacy: 'private',
        category: '22',
        language: 'en',
        tags: []
      }
    },
    seoSettings: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        keywordRefreshInterval: 24,
        competitorChannels: [],
        targetKeywords: [],
        abTestEnabled: true
      }
    },
    promotionSettings: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        reddit: { enabled: false, subreddits: [] },
        telegram: { enabled: false, channels: [] },
        twitter: { enabled: false, hashtags: [] }
      }
    },
    engagementSettings: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        autoComment: false,
        autoLike: false,
        commentTemplates: [],
        engagementRate: 0.1
      }
    },
    statistics: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        totalUploads: 0,
        totalViews: 0,
        totalSubscribers: 0,
        avgEngagement: 0,
        lastAnalyzed: null
      }
    },
    lastActive: {
      type: DataTypes.DATE,
      allowNull: true
    },
    errorCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  return ChannelConfig;
};
