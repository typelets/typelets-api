#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Get version from command line argument
const version = process.argv[2];

if (!version) {
  console.error("Version not provided");
  process.exit(1);
}

// Update src/version.ts
const versionFilePath = path.join(__dirname, "..", "src", "version.ts");
const versionContent = `// This file is automatically updated by semantic-release
export const VERSION = '${version}'`;

fs.writeFileSync(versionFilePath, versionContent, "utf8");
console.log(`Updated version to ${version} in src/version.ts`);
