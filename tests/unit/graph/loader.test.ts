/**
 * Tests for bundle loader.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadBundleToStore, type LoadProgress } from '../../../src/graph/loader';
import { createInMemoryStore } from '../../../src/graph/memory-store';
import { GraphStoreError, type GraphStore } from '../../../src/graph/store';
import type { SemanticGraphBundle, Node } from '../../../src/schema/types';

// Import test fixtures
import smallGraph from '../../../fixtures/sample-graphs/small-graph.json';
import mediumGraph from '../../../fixtures/sample-graphs/medium-graph.json';
import patternRich from '../../../fixtures/sample-graphs/pattern-rich.json';

// Helper to create minimal valid bundle
function createMinimalBundle(overrides: Partial<SemanticGraphBundle> = {}): SemanticGraphBundle {
  return {
    version: 'v1.0',
    generated_at: '2024-01-01T00:00:00Z',
    nodes: [],
    edges: [],
    annotations: [],
    patterns: [],
    ...overrides,
  };
}

describe('loadBundleToStore', () => {
  let store: GraphStore;

  beforeEach(() => {
    store = createInMemoryStore();
  });

  describe('with valid bundles', () => {
    it('should load small-graph.json successfully', async () => {
      const result = await loadBundleToStore(store, smallGraph);

      expect(result.success).toBe(true);
      expect(result.nodesLoaded).toBe(10);
      expect(result.edgesLoaded).toBe(10);
      expect(result.annotationsLoaded).toBe(2);
      expect(result.patternsLoaded).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.errors).toBeUndefined();
    });

    it('should load medium-graph.json successfully', async () => {
      const result = await loadBundleToStore(store, mediumGraph);

      expect(result.success).toBe(true);
      expect(result.nodesLoaded).toBe(35);
      expect(result.edgesLoaded).toBe(71);
      expect(result.annotationsLoaded).toBe(5);
      expect(result.patternsLoaded).toBe(0);
    });

    it('should load pattern-rich.json successfully', async () => {
      const result = await loadBundleToStore(store, patternRich);

      expect(result.success).toBe(true);
      expect(result.patternsLoaded).toBe(4);
    });

    it('should load empty bundle', async () => {
      const bundle = createMinimalBundle();
      const result = await loadBundleToStore(store, bundle);

      expect(result.success).toBe(true);
      expect(result.nodesLoaded).toBe(0);
      expect(result.edgesLoaded).toBe(0);
      expect(result.annotationsLoaded).toBe(0);
      expect(result.patternsLoaded).toBe(0);
    });
  });

  describe('with invalid bundles', () => {
    it('should throw INVALID_BUNDLE for missing required fields', async () => {
      const invalidBundle = { version: 'v1.0' };

      await expect(loadBundleToStore(store, invalidBundle)).rejects.toThrow(GraphStoreError);
      await expect(loadBundleToStore(store, invalidBundle)).rejects.toMatchObject({
        code: 'INVALID_BUNDLE',
      });
    });

    it('should throw INVALID_BUNDLE for invalid node structure', async () => {
      const invalidBundle = createMinimalBundle({
        nodes: [{ invalid: 'node' } as unknown as Node],
      });

      await expect(loadBundleToStore(store, invalidBundle)).rejects.toThrow(GraphStoreError);
    });

    it('should skip validation when validate=false', async () => {
      // This would normally fail validation but should be skipped
      const bundle = createMinimalBundle();
      const result = await loadBundleToStore(store, bundle, { validate: false });

      expect(result.success).toBe(true);
    });
  });

  describe('clearFirst option', () => {
    it('should clear store before loading when clearFirst=true', async () => {
      // First load
      await loadBundleToStore(store, smallGraph);
      let stats = await store.getStats();
      expect(stats.nodeCount).toBe(10);

      // Second load with clearFirst
      const result = await loadBundleToStore(store, smallGraph, { clearFirst: true });

      expect(result.success).toBe(true);
      expect(result.nodesLoaded).toBe(10);
      stats = await store.getStats();
      expect(stats.nodeCount).toBe(10); // Same count, not doubled
    });

    it('should accumulate without clearFirst', async () => {
      // First load
      await loadBundleToStore(store, smallGraph);

      // Create a different bundle with different node IDs
      const anotherBundle = createMinimalBundle({
        nodes: [
          {
            node_id: 'unique-001',
            kind: 'class',
            name: 'UniqueClass',
            language: 'typescript',
            file: 'src/unique.ts',
            span: [0, 100],
          },
        ],
      });

      // Second load without clearFirst
      const result = await loadBundleToStore(store, anotherBundle, { clearFirst: false });

      expect(result.success).toBe(true);
      const stats = await store.getStats();
      expect(stats.nodeCount).toBe(11); // 10 + 1
    });
  });

  describe('progress callback', () => {
    it('should call progress callback during loading', async () => {
      const progressUpdates: LoadProgress[] = [];
      const onProgress = vi.fn((progress: LoadProgress) => {
        progressUpdates.push({ ...progress });
      });

      await loadBundleToStore(store, smallGraph, { onProgress });

      expect(onProgress).toHaveBeenCalled();

      // Should have updates for each phase
      const phases = new Set(progressUpdates.map((p) => p.phase));
      expect(phases.has('validating')).toBe(true);
      expect(phases.has('nodes')).toBe(true);
      expect(phases.has('edges')).toBe(true);
      expect(phases.has('annotations')).toBe(true);
      expect(phases.has('patterns')).toBe(true);

      // Final update for each phase should be 100%
      const nodesFinal = progressUpdates
        .filter((p) => p.phase === 'nodes')
        .pop();
      expect(nodesFinal?.percent).toBe(100);
    });
  });

  describe('error handling', () => {
    it('should report duplicate nodes in errors', async () => {
      // Load once
      await loadBundleToStore(store, smallGraph, { validate: false });

      // Try to load again without clearing
      const result = await loadBundleToStore(store, smallGraph, { validate: false });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.includes('Duplicate node'))).toBe(true);
    });

    it('should continue loading after non-fatal errors', async () => {
      // Create bundle with some valid nodes and try to load twice
      const bundle = createMinimalBundle({
        nodes: [
          {
            node_id: 'node-001',
            kind: 'class',
            name: 'Test',
            language: 'typescript',
            file: 'test.ts',
            span: [0, 10],
          },
          {
            node_id: 'node-002',
            kind: 'class',
            name: 'Test2',
            language: 'typescript',
            file: 'test.ts',
            span: [0, 10],
          },
        ],
      });

      await loadBundleToStore(store, bundle, { validate: false });
      const result = await loadBundleToStore(store, bundle, { validate: false });

      // Should have tried to load all nodes despite errors
      expect(result.nodesLoaded).toBe(0); // All duplicates
      expect(result.errors?.length).toBe(2);
    });

    it('should report invalid edge references', async () => {
      const bundle = createMinimalBundle({
        nodes: [
          {
            node_id: 'node-001',
            kind: 'class',
            name: 'Test',
            language: 'typescript',
            file: 'test.ts',
            span: [0, 10],
          },
        ],
        edges: [
          {
            edge_id: 'edge-001',
            kind: 'calls',
            src: 'node-001',
            dst: 'nonexistent',
            confidence: 1.0,
            evidence: ['static_analysis'],
          },
        ],
      });

      const result = await loadBundleToStore(store, bundle, { validate: false });

      expect(result.success).toBe(false);
      expect(result.edgesLoaded).toBe(0);
      expect(result.errors?.some((e) => e.includes('Invalid edge reference'))).toBe(true);
    });
  });

  describe('result counts', () => {
    it('should report correct counts after successful load', async () => {
      const result = await loadBundleToStore(store, smallGraph);

      const stats = await store.getStats();
      expect(result.nodesLoaded).toBe(stats.nodeCount);
      expect(result.edgesLoaded).toBe(stats.edgeCount);
    });
  });

  describe('performance', () => {
    it('should load 1000 nodes in under 100ms', async () => {
      const nodes: Node[] = [];
      for (let i = 0; i < 1000; i++) {
        nodes.push({
          node_id: `perf-node-${i.toString().padStart(4, '0')}`,
          kind: 'class',
          name: `PerfClass${i}`,
          language: 'typescript',
          file: `src/perf/class${i}.ts`,
          span: [0, 100],
        });
      }

      const bundle = createMinimalBundle({ nodes });

      const result = await loadBundleToStore(store, bundle, { validate: false });

      expect(result.nodesLoaded).toBe(1000);
      expect(result.duration).toBeLessThan(100);
    });
  });
});
