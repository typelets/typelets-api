import * as esbuild from "esbuild";

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

// Run build
try {
  await esbuild.build(buildOptions);
  console.log("✅ Build completed successfully");
} catch (error) {
  console.error("❌ Build failed:", error);
  process.exit(1);
}
