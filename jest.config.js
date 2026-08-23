/**
 * Two projects, on purpose:
 *
 *  - `core` runs the pure game economy (src/game) in plain Node with ts-jest.
 *    No React Native, no transform pipeline, fast. This is the point of the
 *    core/UI split (§3 of the spec).
 *  - `app`  runs services, store and UI under jest-expo, which supplies the RN
 *    module mocks. react-native-mmkv detects Jest and swaps in an in-memory
 *    implementation by itself, so persistence is tested for real.
 */
const coreProject = {
  displayName: 'core',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/game/**/__tests__/**/*.test.ts'],
};

const appProject = {
  displayName: 'app',
  preset: 'jest-expo',
  // NOTE: one pattern per directory on purpose. A brace group directly after
  // the <rootDir> substitution produces a mixed-separator glob on Windows
  // ("…/src\{services,state}/**") that silently matches nothing.
  testMatch: [
    '<rootDir>/src/services/**/__tests__/**/*.test.ts',
    '<rootDir>/src/state/**/__tests__/**/*.test.ts',
    '<rootDir>/src/ui/**/__tests__/**/*.test.ts',
    '<rootDir>/src/ui/**/__tests__/**/*.test.tsx',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // See the stub for why. Merged with jest-expo's own mappings, not replacing them.
    '^react-native-nitro-modules$': '<rootDir>/test/mocks/react-native-nitro-modules.js',
  },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [coreProject, appProject],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**'],
};
