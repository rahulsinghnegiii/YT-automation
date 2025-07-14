const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Upload = sequelize.define('Upload', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    assetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'asset_id'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id'
    },
    platform: {
      type: DataTypes.ENUM('youtube', 'tiktok', 'instagram'),
      defaultValue: 'youtube'
    },
    videoId: {
      type: DataTypes.STRING,
      allowNull: true
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
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true
    },
    privacy: {
      type: DataTypes.ENUM('public', 'unlisted', 'private'),
      defaultValue: 'public'
    },
    status: {
      type: DataTypes.ENUM('pending', 'uploading', 'processing', 'published', 'failed'),
      defaultValue: 'pending'
    },
    progress: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    likeCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    commentCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  return Upload;
};
