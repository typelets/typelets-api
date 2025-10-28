/**
 * Jest test setup file
 * Runs before all tests to configure the test environment
 */

import "dotenv-flow/config";
import { jest } from "@jest/globals";

// Mock environment variables for tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://test:test@localhost:5432/typelets_test";

// Suppress console logs during tests (comment out to debug)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as typeof console;

// Set test timeout
jest.setTimeout(10000);
