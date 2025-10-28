/**
 * Global test teardown - runs once after all test suites
 * Cleans up the test database by dropping all tables
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

export default async function globalTeardown() {
  console.log("🧹 Cleaning up test database...");

  const connectionString =
    process.env.TEST_DATABASE_URL || "postgresql://test:test@localhost:5432/typelets_test";

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    // Drop the entire public schema and recreate it
    // This removes all tables, indexes, and constraints
    await db.execute(sql`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log("✅ Test database cleaned successfully");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    // Don't throw - allow tests to complete even if cleanup fails
  } finally {
    await client.end();
  }
}
