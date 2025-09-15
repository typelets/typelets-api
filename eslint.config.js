// eslint.config.js (replace your old .eslintrc file)
import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node, // Adds Node.js globals like 'process', 'Buffer', etc.
        ...globals.es2021, // Adds modern JavaScript globals
        RequestInit: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        BodyInit: "readonly",
        BufferSource: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      // Add your custom rules here
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-undef": "error",
      "no-unused-vars": "off", // Turn off base rule to avoid conflicts with @typescript-eslint version
    },
  },
  {
    ignores: ["dist/**", "build/**", "node_modules/**", "*.config.js"],
  },
];
