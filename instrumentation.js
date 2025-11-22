// Load environment variables BEFORE OpenTelemetry auto-instrumentation
require('dotenv-flow/config');

// Now require the auto-instrumentation
require('@opentelemetry/auto-instrumentations-node/register');
