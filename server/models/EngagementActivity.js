const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EngagementActivity = sequelize.define('EngagementActivity', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    channelConfigId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'channel_config_id'
    },
    targetVideoId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    targetChannelId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    action: {
      type: DataTypes.ENUM('like', 'comment', 'subscribe', 'view'),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true // comment text
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'detected', 'blocked'),
      defaultValue: 'pending'
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    executedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    response: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    detectionRisk: {
      type: DataTypes.FLOAT,
      defaultValue: 0 // 0-1 scale
    },
    engagementType: {
      type: DataTypes.ENUM('organic', 'targeted', 'competitor', 'trend'),
      defaultValue: 'organic'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        userAgent: null,
        ipAddress: null,
        sessionId: null,
        watchTime: 0,
        deviceInfo: {}
      }
    }
  });

  return EngagementActivity;
};
