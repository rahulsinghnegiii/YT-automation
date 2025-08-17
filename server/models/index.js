const { Sequelize } = require('sequelize');
const path = require('path');

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../data/music_uploader.db'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true
  }
});

// Import models
const User = require('./User')(sequelize);
const Asset = require('./Asset')(sequelize);
const ProcessingJob = require('./ProcessingJob')(sequelize);
const Upload = require('./Upload')(sequelize);
const SystemMetric = require('./SystemMetric')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const ChannelConfig = require('./ChannelConfig')(sequelize);
const Playlist = require('./Playlist')(sequelize);
const PromotionActivity = require('./PromotionActivity')(sequelize);
const EngagementActivity = require('./EngagementActivity')(sequelize);

// Define associations
Asset.hasMany(ProcessingJob, { foreignKey: 'asset_id', as: 'jobs' });
ProcessingJob.belongsTo(Asset, { foreignKey: 'asset_id', as: 'asset' });

Asset.hasMany(Upload, { foreignKey: 'asset_id', as: 'uploads' });
Upload.belongsTo(Asset, { foreignKey: 'asset_id', as: 'asset' });

User.hasMany(Upload, { foreignKey: 'user_id', as: 'uploads' });
Upload.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// New model associations
ChannelConfig.hasMany(Upload, { foreignKey: 'channel_config_id', as: 'uploads' });
Upload.belongsTo(ChannelConfig, { foreignKey: 'channel_config_id', as: 'channelConfig' });

ChannelConfig.hasMany(Playlist, { foreignKey: 'channel_config_id', as: 'playlists' });
Playlist.belongsTo(ChannelConfig, { foreignKey: 'channel_config_id', as: 'channelConfig' });

ChannelConfig.hasMany(EngagementActivity, { foreignKey: 'channel_config_id', as: 'engagementActivities' });
EngagementActivity.belongsTo(ChannelConfig, { foreignKey: 'channel_config_id', as: 'channelConfig' });

Upload.hasMany(PromotionActivity, { foreignKey: 'upload_id', as: 'promotionActivities' });
PromotionActivity.belongsTo(Upload, { foreignKey: 'upload_id', as: 'upload' });

module.exports = {
  sequelize,
  User,
  Asset,
  ProcessingJob,
  Upload,
  SystemMetric,
  AuditLog,
  ChannelConfig,
  Playlist,
  PromotionActivity,
  EngagementActivity
};
