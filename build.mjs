import * as esbuild from "esbuild";
import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";

const isProduction = process.env.NODE_ENV === "production";

// Build configuration
const buildOptions = {
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: "dist/server.js",
  packages: "external",
  sourcemap: true, // Generate source maps
  minify: isProduction, // Minify in production
};

// Add Sentry plugin only in production and when auth token is available
if (isProduction && process.env.SENTRY_AUTH_TOKEN) {
  buildOptions.plugins = [
    sentryEsbuildPlugin({
      org: "bata-labs",
      project: "typelets-api",
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Upload source maps to Sentry
      sourcemaps: {
        assets: "./dist/**",
        filesToDeleteAfterUpload: ["./dist/**/*.map"], // Clean up source map files after upload
      },

      // Set release version
      release: {
        name: process.env.npm_package_version || "1.0.0",
      },
    }),
  ];

  console.log("🔐 Sentry source maps upload enabled");
} else {
  console.log("ℹ️  Sentry source maps upload skipped (development or no auth token)");
}

// Run build
try {
  await esbuild.build(buildOptions);
  console.log("✅ Build completed successfully");
} catch (error) {
  console.error("❌ Build failed:", error);
  process.exit(1);
}
