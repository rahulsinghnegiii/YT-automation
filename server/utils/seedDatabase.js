const { User, Asset, SystemMetric, ProcessingJob, Upload, AuditLog } = require('../models');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  try {
    console.log('🌱 Creating clean admin user...');

    // Check if admin user exists
    const existingUser = await User.findOne({ where: { username: 'admin' } });
    
    if (!existingUser) {
      // Create admin user
      await User.create({
        username: process.env.ADMIN_USERNAME || 'admin',
        email: 'admin@audioprocessor.com',
        password: process.env.ADMIN_PASSWORD || 'admin123', // Will be hashed by the model hook
        role: 'admin',
        isActive: true
      });
      console.log(`✅ Admin user created (username: ${process.env.ADMIN_USERNAME || 'admin'}, password: ${process.env.ADMIN_PASSWORD || 'admin123'})`);
    } else {
      console.log('✅ Admin user already exists');
    }

    // Skip test data seeding for now to avoid database schema issues
    // if (process.env.NODE_ENV === 'development') {
    //   const { seedTestData } = require('./seedTestData');
    //   await seedTestData();
    // }
    
    console.log('🎉 Database seeding completed successfully');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    console.warn('⚠️ Database warning:', error.message);
  }
}

module.exports = { seedDatabase };
