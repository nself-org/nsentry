/**
 * Purpose: ESLint config for ɳSentry mobile (React Native Expo, TypeScript)
 * Inputs: TypeScript source files under src/
 * Outputs: lint errors/warnings
 * Constraints: Uses @typescript-eslint v7; no React-specific rules (no jsx-runtime import needed for RN)
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    browser: false,
    es2020: true,
    node: false,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
  },
  overrides: [
    {
      // Config/mock files are CommonJS Node scripts (module.exports, jest globals)
      files: ['*.js', '__mocks__/**/*.js'],
      env: { node: true, jest: true },
    },
  ],
  ignorePatterns: ['node_modules/', 'android/', 'ios/'],
};
