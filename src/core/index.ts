/**
 * Public surface of the economy core.
 *
 * ARCHITECTURE RULE (non-negotiable): nothing under src/core/ may import React,
 * React Native, or any service. UI and services depend on the core, never the
 * reverse. `economy.test.ts` enforces this.
 */
export * from './numbers';
export * from './types';
export * from './businesses';
export * from './perks';
export * from './economy';
export * from './achievements';
export * from './streak';
export * from './engine';
