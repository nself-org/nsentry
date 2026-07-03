/**
 * Purpose: Jest configuration for jest-expo — pnpm-compatible transformIgnorePatterns.
 * Inputs:  jest-expo preset; @testing-library/jest-native matchers.
 * Outputs: Jest test runner configuration.
 * Constraints: Must use node_modules/.pnpm-aware transform pattern (see ntask
 *   apps/mobile/jest.config.js — same layout); @nself/* mapped to TS sources.
 */
/** @type {import('jest').Config} */
const config = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  // pnpm stores packages under node_modules/.pnpm/<name>@<ver>/node_modules/<name>/.
  // The standard jest-expo pattern only matches node_modules/<name>/ and misses the
  // inner node_modules/ segment for pnpm packages. This pattern handles both layouts.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?' +
      '(?:' +
      '(?:jest-)?react-native' +
      '|@react-native(?:-community)?(?:/[^/]+)?' +
      '|expo(?:nent)?(?:/[^/]+)?' +
      '|@expo(?:nent)?(?:/[^/]+)?' +
      '|@expo-google-fonts(?:/[^/]+)?' +
      '|react-navigation(?:/[^/]+)?' +
      '|@react-navigation(?:/[^/]+)?' +
      '|@nself(?:/[^/]+)?' +
      ')' +
      ')',
  ],
  moduleNameMapper: {
    // Workspace packages resolved to TS sources for Jest.
    '^@nself/nsentry-client/mock$': '<rootDir>/../../packages/client/src/mock.ts',
    '^@nself/nsentry-client(.*)$': '<rootDir>/../../packages/client/src/index.ts',
    '^@nself/auth-core(.*)$': '<rootDir>/../../../packages/@nself/auth-core/src/index.ts',
    '^@nself/errors(.*)$': '<rootDir>/../../../packages/@nself/errors/src/index.ts',
    '^@nself/sdk-core(.*)$': '<rootDir>/../../../packages/@nself/sdk-core/src/index.ts',
    // Resolve .js ESM-style imports to .ts source files for Jest.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Native modules not available in Jest (no native build) — manual mocks
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.js',
  },
};

module.exports = config;
