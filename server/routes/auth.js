const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { User, AuditLog } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { success: false, error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Login route
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ where: { username, isActive: true } });
    
    if (!user || !(await user.comparePassword(password))) {
      await AuditLog.create({
        userId: user ? user.id : null,
        action: 'login_failed',
        resource: 'auth',
        details: { username, reason: user ? 'invalid_password' : 'user_not_found' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: 'Invalid credentials'
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log successful login
    await AuditLog.create({
      userId: user.id,
      action: 'login_success',
      resource: 'auth',
      details: { username },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    logger.info(`User ${username} logged in successfully from ${req.ip}`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin
        }
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Logout route
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      await AuditLog.create({
        userId: decoded.userId,
        action: 'logout',
        resource: 'auth',
        details: { username: decoded.username },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      });

      logger.info(`User ${decoded.username} logged out`);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.json({ success: true, message: 'Logged out successfully' });
  }
});

// Verify token route
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'email', 'role', 'lastLogin', 'isActive']
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token or user inactive'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

// Get current user route
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'email', 'role', 'lastLogin', 'isActive']
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token or user inactive'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

module.exports = router;
