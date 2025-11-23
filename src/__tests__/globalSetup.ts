/**
 * Global test setup - runs once before all test suites
 * Sets up the test database schema using Drizzle migrations
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

export default async function globalSetup() {
  console.log("🔧 Setting up test database with Drizzle migrations...");

  const connectionString =
    process.env.TEST_DATABASE_URL || "postgresql://test:test@localhost:5432/typelets_test";

  // Create a connection with max 1 connection for migrations
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    // Drop and recreate schemas to ensure clean state (TEST DATABASE ONLY)
    // This prevents stale migration records from causing table mismatch issues
    console.log("🧹 Resetting test database schema...");
    await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    await client`DROP SCHEMA public CASCADE`;
    await client`CREATE SCHEMA public`;

    // Run all Drizzle migrations from the drizzle folder
    // Use path.resolve to get absolute path from project root
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    await migrate(db, { migrationsFolder });
    console.log("✅ Test database migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}
