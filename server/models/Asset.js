const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Asset = sequelize.define('Asset', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    originalPath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    processedPath: {
      type: DataTypes.STRING,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('audio', 'video'),
      allowNull: false
    },
    format: {
      type: DataTypes.STRING,
      allowNull: true
    },
    duration: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    size: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    sourceUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('downloaded', 'processing', 'processed', 'uploaded', 'failed'),
      defaultValue: 'downloaded'
    },
    processingProgress: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  return Asset;
};
