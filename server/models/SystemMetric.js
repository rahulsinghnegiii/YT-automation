const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SystemMetric = sequelize.define('SystemMetric', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    cpuPercent: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    memoryPercent: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    diskPercent: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    networkBytesIn: {
      type: DataTypes.BIGINT,
      defaultValue: 0
    },
    networkBytesOut: {
      type: DataTypes.BIGINT,
      defaultValue: 0
    },
    activeProcesses: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    uptime: {
      type: DataTypes.BIGINT,
      allowNull: false
    }
  });

  return SystemMetric;
};
