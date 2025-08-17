const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Playlist = sequelize.define('Playlist', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    playlistId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    channelConfigId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'channel_config_id'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    privacy: {
      type: DataTypes.ENUM('public', 'unlisted', 'private'),
      defaultValue: 'public'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true
    },
    autoManaged: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    rules: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        keywords: [],
        categories: [],
        minDuration: 0,
        maxDuration: 0,
        autoAdd: true,
        maxVideos: 200
      }
    },
    videoCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    totalViews: {
      type: DataTypes.BIGINT,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: true
    },
    performance: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        avgViews: 0,
        avgLikes: 0,
        avgComments: 0,
        engagementRate: 0
      }
    }
  });

  return Playlist;
};
