'use strict';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Debug logging for configuration
console.log('🔧 New Relic Config Loading...');
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   License Key: ${process.env.NEW_RELIC_LICENSE_KEY ? 'Set' : 'Using default'}`);
console.log(`   Development Mode: ${isDevelopment}`);

/**
 * New Relic agent configuration.
 */
exports.config = {
  // Environment-specific app naming
  app_name: [
    isDevelopment ? 'typelets-api-dev' :
    isProduction ? 'typelets-api-prod' :
    'typelets-api-staging'
  ],

  license_key: process.env.NEW_RELIC_LICENSE_KEY,

  // Environment-specific logging configuration
  logging: {
    level: isDevelopment ? 'debug' : 'info',
    filepath: process.env.NEW_RELIC_LOG || (isDevelopment ? 'stdout' : 'newrelic_agent.log'),
    enabled: true
  },

  // Allow all data to be sent in high-security environments
  allow_all_headers: true,

  // Enable distributed tracing
  distributed_tracing: {
    enabled: true
  },

  // Application logging forwarding - more verbose in dev
  application_logging: {
    forwarding: {
      enabled: true,
      max_samples_stored: isDevelopment ? 10000 : 1000
    },
    metrics: {
      enabled: true
    },
    local_decorating: {
      enabled: isDevelopment // Enable log decoration in development
    }
  },

  // Error collection
  error_collector: {
    enabled: true,
    ignore_status_codes: [404],
    capture_events: true,
    max_event_samples_stored: isDevelopment ? 100 : 30
  },

  // Performance monitoring - more detailed in dev
  slow_sql: {
    enabled: true,
    max_samples: isDevelopment ? 20 : 10
  },

  // Transaction tracer - more aggressive in development
  transaction_tracer: {
    enabled: true,
    transaction_threshold: isDevelopment ? 0.1 : 'apdex_f', // 100ms in dev vs apdex_f in prod
    record_sql: 'obfuscated',
    explain_threshold: isDevelopment ? 100 : 500, // Lower threshold in dev
    max_segments: isDevelopment ? 3000 : 2000
  },

  // Custom insights events
  custom_insights_events: {
    enabled: true,
    max_samples_stored: isDevelopment ? 30000 : 1000
  },

  // Feature flags for development debugging
  feature_flag: {
    serverless_mode: false,
    await_support: true,
    promise_segments: true,
    custom_metrics: true
  },

  // Environment-specific data collection
  high_security: isProduction, // Enable high security mode in production

  // Attributes - more permissive in development
  attributes: {
    enabled: true,
    include_enabled: true,
    exclude: isProduction ? [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.x-api-key'
    ] : []
  }
};