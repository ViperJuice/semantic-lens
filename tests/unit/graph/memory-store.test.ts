/**
 * Tests for InMemoryStore implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStore, createInMemoryStore } from '../../../src/graph/memory-store';
import { GraphStoreError } from '../../../src/graph/store';
import type { Node, Edge, Annotation, PatternInstance, SemanticGraphBundle } from '../../../src/schema/types';

// Helper to create test nodes
function createNode(overrides: Partial<Node> = {}): Node {
  return {
    node_id: 'node-001',
    kind: 'class',
    name: 'TestClass',
    language: 'typescript',
    file: 'src/test.ts',
    span: [0, 100],
    ...overrides,
  };
}

// Helper to create test edges
function createEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    edge_id: 'edge-001',
    kind: 'calls',
    src: 'node-001',
    dst: 'node-002',
    confidence: 1.0,
    evidence: ['static_analysis'],
    ...overrides,
  };
}

// Helper to create test bundles
function createBundle(overrides: Partial<SemanticGraphBundle> = {}): SemanticGraphBundle {
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

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('factory function', () => {
    it('should create a GraphStore instance', () => {
      const graphStore = createInMemoryStore();
      expect(graphStore).toBeDefined();
      expect(graphStore.addNode).toBeDefined();
      expect(graphStore.getNode).toBeDefined();
    });
  });

  describe('addNode', () => {
    it('should add a node successfully', async () => {
      const node = createNode();
      await store.addNode(node);

      const retrieved = await store.getNode(node.node_id);
      expect(retrieved).toEqual(node);
    });

    it('should throw DUPLICATE_NODE for duplicate IDs', async () => {
      const node = createNode();
      await store.addNode(node);

      await expect(store.addNode(node)).rejects.toThrow(GraphStoreError);
      await expect(store.addNode(node)).rejects.toMatchObject({
        code: 'DUPLICATE_NODE',
      });
    });
  });

  describe('addEdge', () => {
    it('should add an edge between existing nodes', async () => {
      const node1 = createNode({ node_id: 'node-001' });
      const node2 = createNode({ node_id: 'node-002' });
      const edge = createEdge();

      await store.addNode(node1);
      await store.addNode(node2);
      await store.addEdge(edge);

      const retrieved = await store.getEdge(edge.edge_id);
      expect(retrieved).toEqual(edge);
    });

    it('should throw DUPLICATE_EDGE for duplicate IDs', async () => {
      const node1 = createNode({ node_id: 'node-001' });
      const node2 = createNode({ node_id: 'node-002' });
      const edge = createEdge();

      await store.addNode(node1);
      await store.addNode(node2);
      await store.addEdge(edge);

      await expect(store.addEdge(edge)).rejects.toThrow(GraphStoreError);
      await expect(store.addEdge(edge)).rejects.toMatchObject({
        code: 'DUPLICATE_EDGE',
      });
    });

    it('should throw INVALID_REFERENCE for missing source node', async () => {
      const node2 = createNode({ node_id: 'node-002' });
      const edge = createEdge();

      await store.addNode(node2);

      await expect(store.addEdge(edge)).rejects.toThrow(GraphStoreError);
      await expect(store.addEdge(edge)).rejects.toMatchObject({
        code: 'INVALID_REFERENCE',
      });
    });

    it('should throw INVALID_REFERENCE for missing destination node', async () => {
      const node1 = createNode({ node_id: 'node-001' });
      const edge = createEdge();

      await store.addNode(node1);

      await expect(store.addEdge(edge)).rejects.toThrow(GraphStoreError);
      await expect(store.addEdge(edge)).rejects.toMatchObject({
        code: 'INVALID_REFERENCE',
      });
    });
  });

  describe('addAnnotation', () => {
    it('should add annotation for existing node', async () => {
      const node = createNode();
      await store.addNode(node);

      const annotation: Annotation = {
        target_id: node.node_id,
        tags: ['important', 'reviewed'],
      };
      await store.addAnnotation(annotation);

      const annotations = await store.getAnnotations(node.node_id);
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toEqual(annotation);
    });

    it('should throw INVALID_REFERENCE for missing target node', async () => {
      const annotation: Annotation = {
        target_id: 'nonexistent',
        tags: ['test'],
      };

      await expect(store.addAnnotation(annotation)).rejects.toThrow(GraphStoreError);
      await expect(store.addAnnotation(annotation)).rejects.toMatchObject({
        code: 'INVALID_REFERENCE',
      });
    });
  });

  describe('addPattern', () => {
    it('should add pattern successfully', async () => {
      const node1 = createNode({ node_id: 'node-001' });
      const node2 = createNode({ node_id: 'node-002' });
      await store.addNode(node1);
      await store.addNode(node2);

      const pattern: PatternInstance = {
        instance_id: 'pattern-001',
        pattern_id: 'observer',
        roles: {
          subject: 'node-001',
          observer: 'node-002',
        },
        confidence: 0.9,
        evidence: ['Method notify() found'],
      };
      await store.addPattern(pattern);

      const patterns1 = await store.getPatternsForNode('node-001');
      expect(patterns1).toHaveLength(1);
      expect(patterns1[0]).toEqual(pattern);

      const patterns2 = await store.getPatternsForNode('node-002');
      expect(patterns2).toHaveLength(1);
    });
  });

  describe('getNode', () => {
    it('should return null for unknown node', async () => {
      const result = await store.getNode('nonexistent');
      expect(result).toBeNull();
    });

    it('should return node for known ID', async () => {
      const node = createNode();
      await store.addNode(node);

      const result = await store.getNode(node.node_id);
      expect(result).toEqual(node);
    });
  });

  describe('getEdge', () => {
    it('should return null for unknown edge', async () => {
      const result = await store.getEdge('nonexistent');
      expect(result).toBeNull();
    });

    it('should return edge for known ID', async () => {
      const node1 = createNode({ node_id: 'node-001' });
      const node2 = createNode({ node_id: 'node-002' });
      const edge = createEdge();

      await store.addNode(node1);
      await store.addNode(node2);
      await store.addEdge(edge);

      const result = await store.getEdge(edge.edge_id);
      expect(result).toEqual(edge);
    });
  });

  describe('getEdgesForNode', () => {
    beforeEach(async () => {
      // Create a graph: A -> B -> C
      await store.addNode(createNode({ node_id: 'A', name: 'A' }));
      await store.addNode(createNode({ node_id: 'B', name: 'B' }));
      await store.addNode(createNode({ node_id: 'C', name: 'C' }));
      await store.addEdge(createEdge({ edge_id: 'e1', src: 'A', dst: 'B' }));
      await store.addEdge(createEdge({ edge_id: 'e2', src: 'B', dst: 'C' }));
    });

    it('should return outgoing edges', async () => {
      const edges = await store.getEdgesForNode('B', 'out');
      expect(edges).toHaveLength(1);
      expect(edges[0].edge_id).toBe('e2');
    });

    it('should return incoming edges', async () => {
      const edges = await store.getEdgesForNode('B', 'in');
      expect(edges).toHaveLength(1);
      expect(edges[0].edge_id).toBe('e1');
    });

    it('should return both directions by default', async () => {
      const edges = await store.getEdgesForNode('B', 'both');
      expect(edges).toHaveLength(2);
    });

    it('should return empty array for unknown node', async () => {
      const edges = await store.getEdgesForNode('unknown');
      expect(edges).toEqual([]);
    });
  });

  describe('getNeighbors', () => {
    beforeEach(async () => {
      // Create a graph: A -> B -> C
      await store.addNode(createNode({ node_id: 'A', name: 'A' }));
      await store.addNode(createNode({ node_id: 'B', name: 'B' }));
      await store.addNode(createNode({ node_id: 'C', name: 'C' }));
      await store.addEdge(createEdge({ edge_id: 'e1', src: 'A', dst: 'B' }));
      await store.addEdge(createEdge({ edge_id: 'e2', src: 'B', dst: 'C' }));
    });

    it('should return outgoing neighbors', async () => {
      const neighbors = await store.getNeighbors('B', 'out');
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].node_id).toBe('C');
    });

    it('should return incoming neighbors', async () => {
      const neighbors = await store.getNeighbors('B', 'in');
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].node_id).toBe('A');
    });

    it('should return neighbors in both directions', async () => {
      const neighbors = await store.getNeighbors('B', 'both');
      expect(neighbors).toHaveLength(2);
      const nodeIds = neighbors.map((n) => n.node_id).sort();
      expect(nodeIds).toEqual(['A', 'C']);
    });

    it('should return empty array for unknown node', async () => {
      const neighbors = await store.getNeighbors('unknown', 'both');
      expect(neighbors).toEqual([]);
    });
  });

  describe('findNodes', () => {
    beforeEach(async () => {
      await store.addNode(createNode({
        node_id: 'class1',
        kind: 'class',
        name: 'UserService',
        file: 'src/services/user.ts',
        visibility: 'public',
        language: 'typescript',
        route: 'app.services.UserService',
      }));
      await store.addNode(createNode({
        node_id: 'class2',
        kind: 'class',
        name: 'OrderService',
        file: 'src/services/order.ts',
        visibility: 'public',
        language: 'typescript',
        route: 'app.services.OrderService',
      }));
      await store.addNode(createNode({
        node_id: 'func1',
        kind: 'function',
        name: 'processOrder',
        file: 'src/utils/process.ts',
        visibility: 'private',
        language: 'typescript',
        parent: 'class2',
      }));
      await store.addNode(createNode({
        node_id: 'method1',
        kind: 'method',
        name: 'getUser',
        file: 'src/services/user.ts',
        language: 'typescript',
        parent: 'class1',
      }));
    });

    it('should return all nodes with empty criteria', async () => {
      const nodes = await store.findNodes({});
      expect(nodes).toHaveLength(4);
    });

    it('should filter by kind', async () => {
      const nodes = await store.findNodes({ kind: 'class' });
      expect(nodes).toHaveLength(2);
      expect(nodes.every((n) => n.kind === 'class')).toBe(true);
    });

    it('should filter by multiple kinds', async () => {
      const nodes = await store.findNodes({ kind: ['class', 'function'] });
      expect(nodes).toHaveLength(3);
    });

    it('should filter by file', async () => {
      const nodes = await store.findNodes({ file: 'src/services/user.ts' });
      expect(nodes).toHaveLength(2);
    });

    it('should filter by visibility', async () => {
      const nodes = await store.findNodes({ visibility: 'private' });
      expect(nodes).toHaveLength(1);
      expect(nodes[0].node_id).toBe('func1');
    });

    it('should filter by parent', async () => {
      const nodes = await store.findNodes({ parent: 'class1' });
      expect(nodes).toHaveLength(1);
      expect(nodes[0].node_id).toBe('method1');
    });

    it('should filter by name string', async () => {
      const nodes = await store.findNodes({ name: 'UserService' });
      expect(nodes).toHaveLength(1);
      expect(nodes[0].node_id).toBe('class1');
    });

    it('should filter by name regex', async () => {
      const nodes = await store.findNodes({ name: /Service$/ });
      expect(nodes).toHaveLength(2);
    });

    it('should filter by route string', async () => {
      const nodes = await store.findNodes({ route: 'app.services.UserService' });
      expect(nodes).toHaveLength(1);
    });

    it('should filter by route regex', async () => {
      const nodes = await store.findNodes({ route: /^app\.services\./ });
      expect(nodes).toHaveLength(2);
    });

    it('should filter by language', async () => {
      const nodes = await store.findNodes({ language: 'typescript' });
      expect(nodes).toHaveLength(4);
    });

    it('should combine multiple criteria (AND)', async () => {
      const nodes = await store.findNodes({
        kind: 'class',
        file: 'src/services/user.ts',
      });
      expect(nodes).toHaveLength(1);
      expect(nodes[0].node_id).toBe('class1');
    });
  });

  describe('findEdges', () => {
    beforeEach(async () => {
      await store.addNode(createNode({ node_id: 'A' }));
      await store.addNode(createNode({ node_id: 'B' }));
      await store.addNode(createNode({ node_id: 'C' }));

      await store.addEdge(createEdge({
        edge_id: 'e1',
        kind: 'calls',
        src: 'A',
        dst: 'B',
        confidence: 0.9,
        evidence: ['static_analysis'],
      }));
      await store.addEdge(createEdge({
        edge_id: 'e2',
        kind: 'calls',
        src: 'B',
        dst: 'C',
        confidence: 0.7,
        evidence: ['heuristic'],
      }));
      await store.addEdge(createEdge({
        edge_id: 'e3',
        kind: 'imports',
        src: 'A',
        dst: 'C',
        confidence: 1.0,
        evidence: ['static_analysis', 'lsp'],
      }));
    });

    it('should return all edges with empty criteria', async () => {
      const edges = await store.findEdges({});
      expect(edges).toHaveLength(3);
    });

    it('should filter by kind', async () => {
      const edges = await store.findEdges({ kind: 'calls' });
      expect(edges).toHaveLength(2);
    });

    it('should filter by multiple kinds', async () => {
      const edges = await store.findEdges({ kind: ['calls', 'imports'] });
      expect(edges).toHaveLength(3);
    });

    it('should filter by src', async () => {
      const edges = await store.findEdges({ src: 'A' });
      expect(edges).toHaveLength(2);
    });

    it('should filter by dst', async () => {
      const edges = await store.findEdges({ dst: 'C' });
      expect(edges).toHaveLength(2);
    });

    it('should filter by minConfidence', async () => {
      const edges = await store.findEdges({ minConfidence: 0.8 });
      expect(edges).toHaveLength(2);
    });

    it('should filter by evidence (any match)', async () => {
      const edges = await store.findEdges({ evidence: ['lsp'] });
      expect(edges).toHaveLength(1);
      expect(edges[0].edge_id).toBe('e3');
    });

    it('should combine multiple criteria', async () => {
      const edges = await store.findEdges({
        src: 'A',
        kind: 'calls',
      });
      expect(edges).toHaveLength(1);
      expect(edges[0].edge_id).toBe('e1');
    });
  });

  describe('getSubgraph', () => {
    beforeEach(async () => {
      // Create graph: A -> B -> C -> D
      //                    \-> E
      await store.addNode(createNode({ node_id: 'A' }));
      await store.addNode(createNode({ node_id: 'B' }));
      await store.addNode(createNode({ node_id: 'C' }));
      await store.addNode(createNode({ node_id: 'D' }));
      await store.addNode(createNode({ node_id: 'E' }));

      await store.addEdge(createEdge({ edge_id: 'e1', kind: 'calls', src: 'A', dst: 'B' }));
      await store.addEdge(createEdge({ edge_id: 'e2', kind: 'calls', src: 'B', dst: 'C' }));
      await store.addEdge(createEdge({ edge_id: 'e3', kind: 'calls', src: 'C', dst: 'D' }));
      await store.addEdge(createEdge({ edge_id: 'e4', kind: 'imports', src: 'B', dst: 'E' }));
    });

    it('should return only root with depth 0', async () => {
      const result = await store.getSubgraph('A', 0);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].node_id).toBe('A');
      expect(result.edges).toHaveLength(0);
      expect(result.rootId).toBe('A');
    });

    it('should return direct neighbors with depth 1', async () => {
      const result = await store.getSubgraph('A', 1);
      expect(result.nodes).toHaveLength(2);
      const nodeIds = result.nodes.map((n) => n.node_id).sort();
      expect(nodeIds).toEqual(['A', 'B']);
      expect(result.edges).toHaveLength(1);
    });

    it('should traverse to specified depth', async () => {
      const result = await store.getSubgraph('A', 2);
      expect(result.nodes).toHaveLength(4); // A, B, C, E
      const nodeIds = result.nodes.map((n) => n.node_id).sort();
      expect(nodeIds).toEqual(['A', 'B', 'C', 'E']);
    });

    it('should filter by edge kinds', async () => {
      const result = await store.getSubgraph('A', 3, ['calls']);
      expect(result.nodes).toHaveLength(4); // A, B, C, D (E excluded - only imports edge)
      const nodeIds = result.nodes.map((n) => n.node_id).sort();
      expect(nodeIds).toEqual(['A', 'B', 'C', 'D']);
    });

    it('should throw NODE_NOT_FOUND for unknown root', async () => {
      await expect(store.getSubgraph('unknown', 1)).rejects.toThrow(GraphStoreError);
      await expect(store.getSubgraph('unknown', 1)).rejects.toMatchObject({
        code: 'NODE_NOT_FOUND',
      });
    });

    it('should handle cycles without infinite loop', async () => {
      // Add cycle: D -> A
      await store.addEdge(createEdge({ edge_id: 'e5', kind: 'calls', src: 'D', dst: 'A' }));

      const result = await store.getSubgraph('A', 10);
      // Should still terminate and include all nodes
      expect(result.nodes.length).toBeLessThanOrEqual(5);
    });
  });

  describe('loadBundle', () => {
    it('should load a complete bundle', async () => {
      const bundle = createBundle({
        nodes: [
          createNode({ node_id: 'n1' }),
          createNode({ node_id: 'n2' }),
        ],
        edges: [
          createEdge({ edge_id: 'e1', src: 'n1', dst: 'n2' }),
        ],
        annotations: [
          { target_id: 'n1', tags: ['important'] },
        ],
        patterns: [
          {
            instance_id: 'p1',
            pattern_id: 'singleton',
            roles: { instance: 'n1' },
            confidence: 0.95,
            evidence: ['getInstance method found'],
          },
        ],
      });

      await store.loadBundle(bundle);

      const stats = await store.getStats();
      expect(stats.nodeCount).toBe(2);
      expect(stats.edgeCount).toBe(1);

      const annotations = await store.getAnnotations('n1');
      expect(annotations).toHaveLength(1);

      const patterns = await store.getPatternsForNode('n1');
      expect(patterns).toHaveLength(1);
    });

    it('should load empty bundle', async () => {
      const bundle = createBundle();
      await store.loadBundle(bundle);

      const stats = await store.getStats();
      expect(stats.nodeCount).toBe(0);
      expect(stats.edgeCount).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all data', async () => {
      await store.addNode(createNode({ node_id: 'n1' }));
      await store.addNode(createNode({ node_id: 'n2' }));
      await store.addEdge(createEdge({ edge_id: 'e1', src: 'n1', dst: 'n2' }));

      await store.clear();

      const stats = await store.getStats();
      expect(stats.nodeCount).toBe(0);
      expect(stats.edgeCount).toBe(0);

      const node = await store.getNode('n1');
      expect(node).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return accurate counts', async () => {
      await store.addNode(createNode({ node_id: 'n1', kind: 'class' }));
      await store.addNode(createNode({ node_id: 'n2', kind: 'class' }));
      await store.addNode(createNode({ node_id: 'n3', kind: 'function' }));
      await store.addEdge(createEdge({ edge_id: 'e1', kind: 'calls', src: 'n1', dst: 'n2' }));
      await store.addEdge(createEdge({ edge_id: 'e2', kind: 'imports', src: 'n1', dst: 'n3' }));

      const stats = await store.getStats();

      expect(stats.nodeCount).toBe(3);
      expect(stats.edgeCount).toBe(2);
      expect(stats.nodesByKind.class).toBe(2);
      expect(stats.nodesByKind.function).toBe(1);
      expect(stats.edgesByKind.calls).toBe(1);
      expect(stats.edgesByKind.imports).toBe(1);
    });

    it('should return empty counts for empty store', async () => {
      const stats = await store.getStats();

      expect(stats.nodeCount).toBe(0);
      expect(stats.edgeCount).toBe(0);
      expect(stats.nodesByKind).toEqual({});
      expect(stats.edgesByKind).toEqual({});
    });
  });

  describe('performance', () => {
    it('should load 1000 nodes in under 100ms', async () => {
      const nodes: Node[] = [];
      for (let i = 0; i < 1000; i++) {
        nodes.push(createNode({
          node_id: `node-${i.toString().padStart(4, '0')}`,
          name: `Node${i}`,
        }));
      }

      const bundle = createBundle({ nodes });

      const start = performance.now();
      await store.loadBundle(bundle);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
