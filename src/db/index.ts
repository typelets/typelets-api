// Only load dotenv if DATABASE_URL is not already set (e.g., in tests)
if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
}
import { drizzle } from "drizzle-orm/postgres-js";
import * as postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres.default(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 20,
  idle_timeout: process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT) : 30,
  connect_timeout: process.env.DB_CONNECT_TIMEOUT ? parseInt(process.env.DB_CONNECT_TIMEOUT) : 30,
  max_lifetime: process.env.DB_MAX_LIFETIME ? parseInt(process.env.DB_MAX_LIFETIME) : 60 * 30,
  // Prepared statements - disable cache to avoid "prepared statement does not exist" errors
  prepare: false,
  // Track query performance
  transform: {
    undefined: undefined,
  },
  debug: (_connection, _query, _parameters, _paramTypes) => {
    // Query logging can be enabled via environment variables if needed
  },
});

// Database client ready for use
const originalClient = client;

export const db = drizzle(originalClient, { schema });

export * from "./schema";
