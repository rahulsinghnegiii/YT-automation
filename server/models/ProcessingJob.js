const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProcessingJob = sequelize.define('ProcessingJob', {
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
    type: {
      type: DataTypes.ENUM('download', 'transform', 'semantic', 'upload'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
      defaultValue: 'pending'
    },
    progress: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    result: {
      type: DataTypes.JSON,
      allowNull: true
    }
  });

  return ProcessingJob;
};
