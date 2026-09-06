/**
 * Minimal types for `react-test-renderer`.
 *
 * It ships no types of its own and `@types/react-test-renderer` was retired
 * when React 19 deprecated the package, so there is nothing to install. Only
 * the UI smoke test uses it (see src/ui/__tests__/screens.test.tsx for why it
 * uses this rather than @testing-library/react-native), and it uses exactly
 * these three things — so this declares those three rather than pulling a
 * dependency in for a test file.
 */
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  /** The serialized tree: whatever `toJSON` produced, or null for an empty render. */
  export type ReactTestRendererJSON = unknown;

  export interface ReactTestRenderer {
    toJSON(): ReactTestRendererJSON | null;
    unmount(): void;
  }

  export function create(element: ReactElement): ReactTestRenderer;

  /** Flushes React work; the callback may be sync or async. */
  export function act(callback: () => void | Promise<void>): void;

  const TestRenderer: {
    create: typeof create;
    act: typeof act;
  };
  export default TestRenderer;
}
