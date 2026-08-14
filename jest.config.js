/**
 * Two projects, on purpose:
 *
 *  - `core` runs the pure economy in plain Node with ts-jest. No React Native,
 *    no transform pipeline, ~1s. This is the point of the core/UI split.
 *  - `app`  runs services, store and UI under jest-expo, which supplies the RN
 *    module mocks. react-native-mmkv detects Jest and swaps in an in-memory
 *    implementation by itself, so persistence is tested for real.
 */
const coreProject = {
  displayName: 'core',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/core/**/__tests__/**/*.test.ts'],
};

const appProject = {
  displayName: 'app',
  preset: 'jest-expo',
  // NOTE: one pattern per directory on purpose. A brace group directly after the
  // <rootDir> substitution produces a mixed-separator glob on Windows
  // ("…/src\{services,store}/**") that silently matches nothing.
  testMatch: [
    '<rootDir>/src/services/**/__tests__/**/*.test.ts',
    '<rootDir>/src/store/**/__tests__/**/*.test.ts',
    '<rootDir>/src/ui/**/__tests__/**/*.test.ts',
    '<rootDir>/src/ui/**/__tests__/**/*.test.tsx',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Reanimated 4 runs on react-native-worklets, whose `.native` entry points
  // reach for a TurboModule that does not exist under Jest. This resolver ships
  // with the package and strips those extensions, so the plain JS
  // implementation loads and the animations are exercised for real rather than
  // stubbed out with a mock.
  resolver: 'react-native-worklets/jest/resolver',
  // The core is measured by the `core` project alone. Without this, both
  // projects instrument src/core with different transformers (ts-jest vs
  // babel); the mismatched coverage maps merge badly and under-report it.
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/src/core/'],
  moduleNameMapper: {
    // See the stub for why. Merged with jest-expo's own mappings, not replacing them.
    '^react-native-nitro-modules$': '<rootDir>/test/mocks/react-native-nitro-modules.js',
  },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [coreProject, appProject],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**'],
  coverageThreshold: {
    global: { statements: 95, branches: 82, functions: 95, lines: 95 },
  },
};
