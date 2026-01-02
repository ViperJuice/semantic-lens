/**
 * Tests for Graph Projector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createProjector, type GraphProjector } from '../../../src/view-service/projector/projector.js';
import { InMemoryStore } from '../../../src/graph/memory-store.js';
import type { SemanticGraphBundle } from '../../../src/schema/types.js';
import type { ViewConfig } from '../../../src/view-service/types.js';

describe('GraphProjector', () => {
  let projector: GraphProjector;
  let store: InMemoryStore;

  // Sample bundle for testing
  const sampleBundle: SemanticGraphBundle = {
    version: 'v1.0',
    generated_at: '2026-01-01T00:00:00Z',
    nodes: [
      {
        node_id: 'module-a',
        kind: 'module',
        name: 'ModuleA',
        language: 'typescript',
        file: 'src/module-a.ts',
        span: [0, 100],
      },
      {
        node_id: 'class-b',
        kind: 'class',
        name: 'ClassB',
        language: 'typescript',
        file: 'src/class-b.ts',
        span: [0, 200],
        parent: 'module-a',
      },
      {
        node_id: 'class-c',
        kind: 'class',
        name: 'ClassC',
        language: 'typescript',
        file: 'src/class-c.ts',
        span: [0, 150],
      },
      {
        node_id: 'method-d',
        kind: 'method',
        name: 'methodD',
        language: 'typescript',
        file: 'src/class-b.ts',
        span: [50, 100],
        parent: 'class-b',
      },
      {
        node_id: 'func-e',
        kind: 'function',
        name: 'funcE',
        language: 'typescript',
        file: 'src/utils.ts',
        span: [0, 50],
      },
      {
        node_id: 'vendor-f',
        kind: 'module',
        name: 'VendorF',
        language: 'typescript',
        file: 'node_modules/vendor/index.ts',
        span: [0, 100],
      },
    ],
    edges: [
      {
        edge_id: 'edge-1',
        kind: 'calls',
        src: 'method-d',
        dst: 'func-e',
        confidence: 0.9,
        evidence: ['static_analysis'],
      },
      {
        edge_id: 'edge-2',
        kind: 'inherits',
        src: 'class-b',
        dst: 'class-c',
        confidence: 1.0,
        evidence: ['static_analysis'],
      },
      {
        edge_id: 'edge-3',
        kind: 'imports',
        src: 'module-a',
        dst: 'vendor-f',
        confidence: 0.8,
        evidence: ['static_analysis'],
      },
      {
        edge_id: 'edge-4',
        kind: 'defines',
        src: 'module-a',
        dst: 'class-b',
        confidence: 1.0,
        evidence: ['static_analysis'],
      },
      {
        edge_id: 'edge-5',
        kind: 'uses',
        src: 'class-b',
        dst: 'func-e',
        confidence: 0.5,
        evidence: ['heuristic'],
      },
    ],
    annotations: [],
    patterns: [],
  };

  beforeEach(async () => {
    projector = createProjector();
    store = new InMemoryStore();
    await store.loadBundle(sampleBundle);
  });

  describe('createProjector', () => {
    it('should create a projector instance', () => {
      expect(projector).toBeDefined();
      expect(typeof projector.project).toBe('function');
      expect(typeof projector.getEdgeKindsForView).toBe('function');
    });
  });

  describe('getEdgeKindsForView', () => {
    it('should return correct edge kinds for call_graph', () => {
      const kinds = projector.getEdgeKindsForView('call_graph');
      expect(kinds).toContain('calls');
      expect(kinds).toContain('uses');
      expect(kinds).not.toContain('inherits');
    });

    it('should return correct edge kinds for inheritance', () => {
      const kinds = projector.getEdgeKindsForView('inheritance');
      expect(kinds).toContain('inherits');
      expect(kinds).toContain('implements');
      expect(kinds).not.toContain('calls');
    });

    it('should return correct edge kinds for module_deps', () => {
      const kinds = projector.getEdgeKindsForView('module_deps');
      expect(kinds).toContain('imports');
      expect(kinds).toContain('defines');
      expect(kinds).not.toContain('calls');
    });

    it('should return all edge kinds for full view', () => {
      const kinds = projector.getEdgeKindsForView('full');
      expect(kinds.length).toBeGreaterThanOrEqual(5);
      expect(kinds).toContain('calls');
      expect(kinds).toContain('inherits');
      expect(kinds).toContain('imports');
    });
  });

  describe('project', () => {
    describe('view type filtering', () => {
      it('should filter edges by view type - call_graph', async () => {
        const config: ViewConfig = { view: 'call_graph' };
        const result = await projector.project(store, config);

        // Should only include calls and uses edges
        expect(result.edges.every((e) => ['calls', 'uses'].includes(e.kind))).toBe(true);
        expect(result.edges.some((e) => e.kind === 'calls')).toBe(true);
      });

      it('should filter edges by view type - inheritance', async () => {
        const config: ViewConfig = { view: 'inheritance' };
        const result = await projector.project(store, config);

        // Should only include inherits and implements edges
        expect(result.edges.every((e) => ['inherits', 'implements'].includes(e.kind))).toBe(true);
      });

      it('should filter edges by view type - module_deps', async () => {
        const config: ViewConfig = { view: 'module_deps' };
        const result = await projector.project(store, config);

        // Should only include imports and defines edges
        expect(result.edges.every((e) => ['imports', 'defines'].includes(e.kind))).toBe(true);
      });

      it('should include all edges for full view', async () => {
        const config: ViewConfig = { view: 'full' };
        const result = await projector.project(store, config);

        expect(result.edges.length).toBe(5);
      });
    });

    describe('subgraph extraction with root_id', () => {
      it('should extract subgraph from root node', async () => {
        const config: ViewConfig = {
          view: 'full',
          root_id: 'module-a',
          depth: 1,
        };
        const result = await projector.project(store, config);

        expect(result.rootId).toBe('module-a');
        expect(result.nodes.some((n) => n.node_id === 'module-a')).toBe(true);
      });

      it('should respect depth parameter', async () => {
        const config: ViewConfig = {
          view: 'full',
          root_id: 'module-a',
          depth: 0,
        };
        const result = await projector.project(store, config);

        // Depth 0 should only include root node
        expect(result.nodes.length).toBe(1);
        expect(result.nodes[0]?.node_id).toBe('module-a');
      });
    });

    describe('confidence filtering', () => {
      it('should filter edges by minimum confidence', async () => {
        const config: ViewConfig = {
          view: 'full',
          min_confidence: 0.85,
        };
        const result = await projector.project(store, config);

        expect(result.edges.every((e) => e.confidence >= 0.85)).toBe(true);
        expect(result.edges.some((e) => e.confidence === 0.5)).toBe(false);
      });

      it('should include all edges when min_confidence is 0', async () => {
        const config: ViewConfig = {
          view: 'full',
          min_confidence: 0,
        };
        const result = await projector.project(store, config);

        expect(result.edges.length).toBe(5);
      });
    });

    describe('path exclusions', () => {
      it('should exclude nodes matching path patterns', async () => {
        const config: ViewConfig = {
          view: 'full',
          exclude_paths: ['node_modules/**'],
        };
        const result = await projector.project(store, config);

        expect(result.nodes.some((n) => n.node_id === 'vendor-f')).toBe(false);
        expect(result.nodes.some((n) => n.node_id === 'module-a')).toBe(true);
      });

      it('should exclude edges to/from excluded nodes', async () => {
        const config: ViewConfig = {
          view: 'full',
          exclude_paths: ['node_modules/**'],
        };
        const result = await projector.project(store, config);

        // Edge from module-a to vendor-f should be removed
        expect(result.edges.some((e) => e.dst === 'vendor-f')).toBe(false);
      });

      it('should handle multiple exclusion patterns', async () => {
        const config: ViewConfig = {
          view: 'full',
          exclude_paths: ['node_modules/**', 'src/utils.ts'],
        };
        const result = await projector.project(store, config);

        expect(result.nodes.some((n) => n.node_id === 'vendor-f')).toBe(false);
        expect(result.nodes.some((n) => n.node_id === 'func-e')).toBe(false);
      });
    });

    describe('collapse semantics', () => {
      it('should collapse children under parent kind', async () => {
        const config: ViewConfig = {
          view: 'full',
          collapse_kinds: ['class'],
        };
        const result = await projector.project(store, config);

        // method-d should be collapsed (its parent class-b has kind 'class')
        expect(result.nodes.some((n) => n.node_id === 'method-d')).toBe(false);
        // class-b should still exist
        expect(result.nodes.some((n) => n.node_id === 'class-b')).toBe(true);
      });

      it('should reroute edges from collapsed nodes', async () => {
        const config: ViewConfig = {
          view: 'call_graph',
          collapse_kinds: ['class'],
        };
        const result = await projector.project(store, config);

        // The edge from method-d -> func-e should become class-b -> func-e
        const callEdge = result.edges.find((e) => e.dst === 'func-e' && e.kind === 'calls');
        if (callEdge) {
          expect(callEdge.src).toBe('class-b');
        }
      });
    });

    describe('custom edge_kinds override', () => {
      it('should use custom edge_kinds when provided', async () => {
        const config: ViewConfig = {
          view: 'call_graph', // normally calls and uses
          edge_kinds: ['inherits'], // override to only inherits
        };
        const result = await projector.project(store, config);

        expect(result.edges.every((e) => e.kind === 'inherits')).toBe(true);
      });
    });

    describe('empty and edge cases', () => {
      it('should handle empty graph', async () => {
        const emptyStore = new InMemoryStore();
        const config: ViewConfig = { view: 'full' };
        const result = await projector.project(emptyStore, config);

        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
      });

      it('should throw error for non-existent root_id', async () => {
        const config: ViewConfig = {
          view: 'full',
          root_id: 'non-existent',
          depth: 2,
        };

        await expect(projector.project(store, config)).rejects.toThrow('not found');
      });
    });
  });
});
