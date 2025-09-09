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
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      // Add your custom rules here
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-undef": "error",
    },
  },
  {
    ignores: ["dist/**", "build/**", "node_modules/**", "*.config.js"],
  },
];
