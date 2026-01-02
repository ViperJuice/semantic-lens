/**
 * Graph module public API.
 * Re-exports all public types, interfaces, and factory functions.
 */

// Core interface and types
export type {
  GraphStore,
  NodeQuery,
  EdgeQuery,
  SubgraphResult,
  GraphStats,
  Direction,
  GraphStoreErrorCode,
} from './store.js';

export { GraphStoreError } from './store.js';

// InMemoryStore implementation
export { InMemoryStore, createInMemoryStore } from './memory-store.js';

// MemgraphStore implementation
export type { MemgraphConfig } from './memgraph-store.js';
export {
  MemgraphStore,
  createMemgraphStore,
  isMemgraphAvailable,
} from './memgraph-store.js';
