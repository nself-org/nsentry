/**
 * Purpose: ESLint config for @nself/nsentry-client (pure TypeScript, no framework)
 * Inputs: TypeScript source under src/
 * Outputs: lint errors/warnings
 * Constraints: mirrors apps/mobile config; no React rules needed
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { es2021: true },
  overrides: [
    {
      // Config/build files are CommonJS Node scripts (module.exports)
      files: ['*.js'],
      env: { node: true },
    },
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
  },
  ignorePatterns: ['node_modules/'],
};
