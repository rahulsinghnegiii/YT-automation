const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PromotionActivity = sequelize.define('PromotionActivity', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    uploadId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'upload_id'
    },
    platform: {
      type: DataTypes.ENUM('reddit', 'telegram', 'twitter', 'discord'),
      allowNull: false
    },
    action: {
      type: DataTypes.ENUM('post', 'comment', 'repost', 'like', 'follow'),
      allowNull: false
    },
    target: {
      type: DataTypes.STRING,
      allowNull: false // subreddit, channel, username, etc.
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    postId: {
      type: DataTypes.STRING,
      allowNull: true // external platform post ID
    },
    status: {
      type: DataTypes.ENUM('pending', 'posted', 'failed', 'removed'),
      defaultValue: 'pending'
    },
    engagement: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0
      }
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    postedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    performance: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        clickThroughRate: 0,
        conversionRate: 0,
        engagementRate: 0,
        reach: 0
      }
    }
  });

  return PromotionActivity;
};
