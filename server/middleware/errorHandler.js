const logger = require('../utils/logger');

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Global error handler:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Ensure we always return JSON
  res.setHeader('Content-Type', 'application/json');

  // Handle different error types
  let statusCode = 500;
  let message = 'Internal server error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.status) {
    statusCode = err.status;
    message = err.message;
  }

  // Don't expose stack trace in production
  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err.details || null;
  }

  res.status(statusCode).json(response);
};

// 404 handler for API routes
const notFoundHandler = (req, res, next) => {
  // Only handle API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error creator
const createValidationError = (message, details = null) => {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.statusCode = 400;
  error.details = details;
  return error;
};

// Not found error creator
const createNotFoundError = (resource) => {
  const error = new Error(`${resource} not found`);
  error.statusCode = 404;
  return error;
};

// Unauthorized error creator
const createUnauthorizedError = (message = 'Unauthorized access') => {
  const error = new Error(message);
  error.name = 'UnauthorizedError';
  error.statusCode = 401;
  return error;
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createValidationError,
  createNotFoundError,
  createUnauthorizedError
};
