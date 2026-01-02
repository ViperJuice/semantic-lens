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

// Bundle loader
export type {
  LoadOptions,
  LoadResult,
  LoadProgress,
  ProgressCallback,
} from './loader.js';
export { loadBundleToStore } from './loader.js';

// Query utilities
export type { Path } from './queries.js';
export {
  getPath,
  getConnectedComponent,
  findByRoute,
  findByFile,
  findByKind,
  getCallers,
  getCallees,
  getCallGraph,
  findOrphanNodes,
  findConnectedNodes,
} from './queries.js';
