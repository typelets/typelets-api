/**
 * Database test helpers
 * Utilities for managing test database state
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

/**
 * Truncates all tables in the test database
 * Use this in beforeEach() to ensure a clean slate for each test
 *
 * @example
 * beforeEach(async () => {
 *   await cleanupDatabase();
 * });
 */
export const cleanupDatabase = async () => {
  // Truncate all tables in reverse dependency order to avoid foreign key violations
  // CASCADE ensures all dependent rows are also removed
  await db.execute(sql`TRUNCATE file_attachments, notes, folders, users CASCADE`);
};

/**
 * Counts rows in a table
 * Useful for verifying data was created or deleted
 *
 * @example
 * const userCount = await countRows("users");
 * expect(userCount).toBe(1);
 */
export const countRows = async (tableName: string): Promise<number> => {
  const result = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`);
  const rows = result as unknown as Array<{ count: string }>;
  return parseInt(rows[0].count);
};

/**
 * Checks if a table exists in the database
 * Useful for verifying migrations ran correctly
 *
 * @example
 * const exists = await tableExists("users");
 * expect(exists).toBe(true);
 */
export const tableExists = async (tableName: string): Promise<boolean> => {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ) as exists
  `);
  const rows = result as unknown as Array<{ exists: boolean }>;
  return rows[0].exists;
};
