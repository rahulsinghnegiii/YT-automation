const logger = require('./logger');

/**
 * Environment Variable Validation
 * Validates required environment variables based on environment mode
 */

// Required environment variables for all environments
const REQUIRED_ALWAYS = [
  'NODE_ENV',
  'JWT_SECRET'
];

// Required environment variables for production only
const REQUIRED_PRODUCTION = [
  'ADMIN_PASSWORD'
];

// Optional but recommended API keys for full functionality
const RECOMMENDED_APIS = {
  'YOUTUBE_CLIENT_ID_1': 'YouTube video upload functionality',
  'YOUTUBE_CLIENT_SECRET_1': 'YouTube video upload functionality',
  'OPENAI_API_KEY': 'AI-powered content enhancement and semantic enrichment',
  'SPOTIFY_CLIENT_ID': 'Spotify integration for music metadata',
  'SOUNDCLOUD_CLIENT_ID': 'SoundCloud integration for music uploads'
};

// Critical API keys that should be present in production
const CRITICAL_PRODUCTION_APIS = [
  'YOUTUBE_CLIENT_ID_1',
  'YOUTUBE_CLIENT_SECRET_1'
];

/**
 * Validate environment variables
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Whether to fail on missing critical APIs in production
 * @returns {Object} Validation result
 */
function validateEnvironment(options = { strict: false }) {
  const env = process.env;
  const isDevelopment = env.NODE_ENV === 'development';
  const isProduction = env.NODE_ENV === 'production';
  
  const errors = [];
  const warnings = [];
  const info = [];

  // Check always required variables
  for (const variable of REQUIRED_ALWAYS) {
    if (!env[variable]) {
      errors.push(`Missing required environment variable: ${variable}`);
    } else if (variable === 'JWT_SECRET' && env[variable].length < 32) {
      errors.push(`JWT_SECRET must be at least 32 characters long (current: ${env[variable].length})`);
    }
  }

  // Check production-only required variables
  if (isProduction) {
    for (const variable of REQUIRED_PRODUCTION) {
      if (!env[variable]) {
        errors.push(`Missing required environment variable for production: ${variable}`);
      }
    }

    // Check critical APIs in production
    for (const apiKey of CRITICAL_PRODUCTION_APIS) {
      if (!env[apiKey]) {
        const message = `Missing critical API key for production: ${apiKey}`;
        if (options.strict) {
          errors.push(message);
        } else {
          warnings.push(message + ' - Some features will be disabled');
        }
      }
    }
  }

  // Check recommended APIs
  const missingApis = [];
  for (const [apiKey, description] of Object.entries(RECOMMENDED_APIS)) {
    if (!env[apiKey]) {
      missingApis.push({ key: apiKey, description });
    }
  }

  if (missingApis.length > 0) {
    if (isDevelopment) {
      info.push('Mock data will be used for missing APIs in development mode');
      missingApis.forEach(({ key, description }) => {
        info.push(`  • ${key}: ${description}`);
      });
    } else {
      missingApis.forEach(({ key, description }) => {
        warnings.push(`Optional API key missing: ${key} - ${description}`);
      });
    }
  }

  // Environment-specific validations
  if (isDevelopment) {
    info.push('Running in DEVELOPMENT mode with mock data support');
    
    // Check if mock data files exist
    const fs = require('fs');
    const path = require('path');
    const mockDir = path.join(__dirname, '../../mock');
    
    if (fs.existsSync(mockDir)) {
      const mockFiles = fs.readdirSync(mockDir).filter(file => file.endsWith('.js'));
      if (mockFiles.length > 0) {
        info.push(`Mock data available: ${mockFiles.join(', ')}`);
      }
    }
  }

  if (isProduction) {
    info.push('Running in PRODUCTION mode - all APIs will be used');
    
    // Additional production checks
    if (env.JWT_SECRET === 'your_super_secure_jwt_secret_at_least_32_characters_long_here') {
      errors.push('JWT_SECRET appears to be the default example value. Please use a unique secret.');
    }
    
    if (env.ADMIN_PASSWORD === 'admin' || env.ADMIN_PASSWORD === 'admin123') {
      warnings.push('ADMIN_PASSWORD appears to use a common default. Consider using a stronger password.');
    }
  }

  const result = {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    environment: env.NODE_ENV,
    mockDataMode: isDevelopment && missingApis.length > 0
  };

  return result;
}

/**
 * Log validation results
 * @param {Object} validation - Validation result from validateEnvironment
 */
function logValidationResults(validation) {
  const { errors, warnings, info, environment, mockDataMode } = validation;

  logger.info(`🔧 Environment: ${environment.toUpperCase()}`);
  
  if (mockDataMode) {
    logger.info('📊 Mock data mode enabled for missing APIs');
  }

  // Log errors
  if (errors.length > 0) {
    logger.error('❌ Environment validation errors:');
    errors.forEach(error => logger.error(`  • ${error}`));
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn('⚠️  Environment validation warnings:');
    warnings.forEach(warning => logger.warn(`  • ${warning}`));
  }

  // Log info messages
  if (info.length > 0) {
    logger.info('ℹ️  Environment info:');
    info.forEach(infoMsg => logger.info(`  • ${infoMsg}`));
  }

  if (validation.valid) {
    logger.info('✅ Environment validation passed');
  } else {
    logger.error('❌ Environment validation failed');
  }

  return validation.valid;
}

/**
 * Validate environment and exit if critical errors found
 * @param {Object} options - Validation options
 */
function validateOrExit(options = { strict: false }) {
  const validation = validateEnvironment(options);
  const isValid = logValidationResults(validation);

  if (!isValid) {
    logger.error('🛑 Server startup aborted due to environment validation errors');
    logger.error('💡 Please check your .env file and fix the errors above');
    process.exit(1);
  }

  return validation;
}

/**
 * Get missing API keys for development info
 */
function getMissingApis() {
  const env = process.env;
  const missing = [];

  for (const [apiKey, description] of Object.entries(RECOMMENDED_APIS)) {
    if (!env[apiKey]) {
      missing.push({ key: apiKey, description });
    }
  }

  return missing;
}

module.exports = {
  validateEnvironment,
  validateOrExit,
  logValidationResults,
  getMissingApis,
  REQUIRED_ALWAYS,
  REQUIRED_PRODUCTION,
  RECOMMENDED_APIS,
  CRITICAL_PRODUCTION_APIS
};
