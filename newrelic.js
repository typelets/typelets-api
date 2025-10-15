"use strict";

/**
 * New Relic agent configuration.
 */
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || "Typelets API"],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || "",
  logging: {
    level:
      process.env.NEW_RELIC_LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "warn"),
    filepath: "stdout",
  },
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000,
    },
    metrics: {
      enabled: true,
    },
    local_decorating: {
      enabled: true,
    },
  },
  distributed_tracing: {
    enabled: true,
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      "request.headers.cookie",
      "request.headers.authorization",
      "request.headers.proxyAuthorization",
      "request.headers.setCookie*",
      "request.headers.x*",
      "response.headers.cookie",
      "response.headers.authorization",
      "response.headers.proxyAuthorization",
      "response.headers.setCookie*",
      "response.headers.x*",
    ],
  },
};
