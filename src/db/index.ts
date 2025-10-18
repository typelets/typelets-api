import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import * as postgres from "postgres";
import * as schema from "./schema";
import * as prometheus from "../lib/prometheus";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres.default(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 20,
  idle_timeout: process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT) : 20,
  connect_timeout: process.env.DB_CONNECT_TIMEOUT ? parseInt(process.env.DB_CONNECT_TIMEOUT) : 10,
  // Track query performance
  transform: {
    undefined: undefined,
  },
  debug: (connection, query, parameters, paramTypes) => {
    // Extract operation type (SELECT, INSERT, UPDATE, DELETE)
    const operation = query.trim().split(" ")[0].toUpperCase();

    // Try to extract table name (simplified - matches first FROM or INTO)
    let table = "unknown";
    const fromMatch = query.match(/\s+FROM\s+["']?(\w+)["']?/i);
    const intoMatch = query.match(/\s+INTO\s+["']?(\w+)["']?/i);
    const updateMatch = query.match(/^UPDATE\s+["']?(\w+)["']?/i);

    if (fromMatch) table = fromMatch[1];
    else if (intoMatch) table = intoMatch[1];
    else if (updateMatch) table = updateMatch[1];

    // Record the query
    prometheus.databaseQueriesTotal.inc({ operation, table });
  },
});

// Wrap client to measure query duration
const originalClient = client;
const wrappedClient = new Proxy(client, {
  apply(target, thisArg, args) {
    const startTime = Date.now();
    const result = Reflect.apply(target, thisArg, args);

    if (result && typeof result.then === "function") {
      return result.then((res: any) => {
        const duration = Date.now() - startTime;
        // Extract operation from first arg (SQL string)
        if (args[0] && typeof args[0] === "string") {
          const operation = args[0].trim().split(" ")[0].toUpperCase();
          const fromMatch = args[0].match(/\s+FROM\s+["']?(\w+)["']?/i);
          const intoMatch = args[0].match(/\s+INTO\s+["']?(\w+)["']?/i);
          const updateMatch = args[0].match(/^UPDATE\s+["']?(\w+)["']?/i);

          let table = "unknown";
          if (fromMatch) table = fromMatch[1];
          else if (intoMatch) table = intoMatch[1];
          else if (updateMatch) table = updateMatch[1];

          prometheus.databaseQueryDuration.observe({ operation, table }, duration);
        }
        return res;
      });
    }
    return result;
  },
});

export const db = drizzle(originalClient, { schema });

export * from "./schema";
