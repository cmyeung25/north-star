module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  ignorePatterns: ["dist/", ".next/", "node_modules/"],
  overrides: [
    {
      files: ["apps/web/**/*.{ts,tsx}"],
      extends: ["next/core-web-vitals", "prettier"]
    }
  ]
};
