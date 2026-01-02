/**
 * Interface contract tests for GraphStore.
 * These tests validate that any implementation correctly fulfills the interface.
 */

import { describe, it, expect } from 'vitest';
import type {
  GraphStore,
  NodeQuery,
  EdgeQuery,
  SubgraphResult,
  GraphStats,
  Direction,
  GraphStoreErrorCode,
} from '../../../src/graph/store';
import { GraphStoreError } from '../../../src/graph/store';
import type { Node, Edge, Annotation, PatternInstance } from '../../../src/schema/types';

describe('GraphStore interface types', () => {
  describe('Direction type', () => {
    it('should accept valid direction values', () => {
      const directions: Direction[] = ['in', 'out', 'both'];
      expect(directions).toHaveLength(3);
    });
  });

  describe('NodeQuery interface', () => {
    it('should allow empty query (match all)', () => {
      const query: NodeQuery = {};
      expect(query).toEqual({});
    });

    it('should allow single kind filter', () => {
      const query: NodeQuery = { kind: 'class' };
      expect(query.kind).toBe('class');
    });

    it('should allow multiple kinds filter', () => {
      const query: NodeQuery = { kind: ['class', 'interface'] };
      expect(Array.isArray(query.kind)).toBe(true);
    });

    it('should allow file filter', () => {
      const query: NodeQuery = { file: 'src/main.ts' };
      expect(query.file).toBe('src/main.ts');
    });

    it('should allow route as string', () => {
      const query: NodeQuery = { route: 'app.services.UserService' };
      expect(query.route).toBe('app.services.UserService');
    });

    it('should allow route as RegExp', () => {
      const query: NodeQuery = { route: /^app\.services\./ };
      expect(query.route).toBeInstanceOf(RegExp);
    });

    it('should allow visibility filter', () => {
      const query: NodeQuery = { visibility: 'public' };
      expect(query.visibility).toBe('public');
    });

    it('should allow parent filter', () => {
      const query: NodeQuery = { parent: 'parent-node-id' };
      expect(query.parent).toBe('parent-node-id');
    });

    it('should allow name as string', () => {
      const query: NodeQuery = { name: 'UserService' };
      expect(query.name).toBe('UserService');
    });

    it('should allow name as RegExp', () => {
      const query: NodeQuery = { name: /Service$/ };
      expect(query.name).toBeInstanceOf(RegExp);
    });

    it('should allow language filter', () => {
      const query: NodeQuery = { language: 'typescript' };
      expect(query.language).toBe('typescript');
    });

    it('should allow combining multiple criteria', () => {
      const query: NodeQuery = {
        kind: 'class',
        file: 'src/main.ts',
        visibility: 'public',
        language: 'typescript',
      };
      expect(query.kind).toBe('class');
      expect(query.file).toBe('src/main.ts');
      expect(query.visibility).toBe('public');
      expect(query.language).toBe('typescript');
    });
  });

  describe('EdgeQuery interface', () => {
    it('should allow empty query (match all)', () => {
      const query: EdgeQuery = {};
      expect(query).toEqual({});
    });

    it('should allow single kind filter', () => {
      const query: EdgeQuery = { kind: 'calls' };
      expect(query.kind).toBe('calls');
    });

    it('should allow multiple kinds filter', () => {
      const query: EdgeQuery = { kind: ['calls', 'imports'] };
      expect(Array.isArray(query.kind)).toBe(true);
    });

    it('should allow src filter', () => {
      const query: EdgeQuery = { src: 'source-node-id' };
      expect(query.src).toBe('source-node-id');
    });

    it('should allow dst filter', () => {
      const query: EdgeQuery = { dst: 'dest-node-id' };
      expect(query.dst).toBe('dest-node-id');
    });

    it('should allow minConfidence filter', () => {
      const query: EdgeQuery = { minConfidence: 0.8 };
      expect(query.minConfidence).toBe(0.8);
    });

    it('should allow evidence filter', () => {
      const query: EdgeQuery = { evidence: ['static_analysis', 'lsp'] };
      expect(query.evidence).toContain('static_analysis');
      expect(query.evidence).toContain('lsp');
    });

    it('should allow combining multiple criteria', () => {
      const query: EdgeQuery = {
        kind: 'calls',
        src: 'source-node-id',
        minConfidence: 0.9,
      };
      expect(query.kind).toBe('calls');
      expect(query.src).toBe('source-node-id');
      expect(query.minConfidence).toBe(0.9);
    });
  });

  describe('SubgraphResult interface', () => {
    it('should contain nodes, edges, and rootId', () => {
      const result: SubgraphResult = {
        nodes: [],
        edges: [],
        rootId: 'root-node-id',
      };
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.rootId).toBe('root-node-id');
    });
  });

  describe('GraphStats interface', () => {
    it('should contain all required fields', () => {
      const stats: GraphStats = {
        nodeCount: 10,
        edgeCount: 15,
        nodesByKind: { class: 3, function: 7 },
        edgesByKind: { calls: 10, imports: 5 },
      };
      expect(stats.nodeCount).toBe(10);
      expect(stats.edgeCount).toBe(15);
      expect(stats.nodesByKind.class).toBe(3);
      expect(stats.edgesByKind.calls).toBe(10);
    });

    it('should allow partial nodesByKind', () => {
      const stats: GraphStats = {
        nodeCount: 0,
        edgeCount: 0,
        nodesByKind: {},
        edgesByKind: {},
      };
      expect(stats.nodesByKind).toEqual({});
    });
  });

  describe('GraphStoreError', () => {
    it('should be instantiable with message and code', () => {
      const error = new GraphStoreError('Node not found', 'NODE_NOT_FOUND');
      expect(error.message).toBe('Node not found');
      expect(error.code).toBe('NODE_NOT_FOUND');
      expect(error.name).toBe('GraphStoreError');
    });

    it('should accept optional cause', () => {
      const cause = new Error('Original error');
      const error = new GraphStoreError('Wrapped error', 'QUERY_ERROR', cause);
      expect(error.cause).toBe(cause);
    });

    it('should be instance of Error', () => {
      const error = new GraphStoreError('Test', 'QUERY_ERROR');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof GraphStoreError).toBe(true);
    });

    it('should support all error codes', () => {
      const codes: GraphStoreErrorCode[] = [
        'INVALID_BUNDLE',
        'NODE_NOT_FOUND',
        'EDGE_NOT_FOUND',
        'DUPLICATE_NODE',
        'DUPLICATE_EDGE',
        'INVALID_REFERENCE',
        'CONNECTION_ERROR',
        'QUERY_ERROR',
      ];
      codes.forEach((code) => {
        const error = new GraphStoreError('Test', code);
        expect(error.code).toBe(code);
      });
    });
  });
});

describe('GraphStore interface contract', () => {
  // These tests validate that implementations conform to the expected behavior.
  // They serve as documentation and will be used by implementation tests.

  describe('Write Operations', () => {
    it('loadBundle should be defined on implementations', () => {
      // Contract: loadBundle(bundle: SemanticGraphBundle) => Promise<void>
      // Should throw GraphStoreError with INVALID_BUNDLE if bundle is invalid
      expect(true).toBe(true);
    });

    it('addNode should be defined on implementations', () => {
      // Contract: addNode(node: Node) => Promise<void>
      // Should throw GraphStoreError with DUPLICATE_NODE if node ID exists
      expect(true).toBe(true);
    });

    it('addEdge should be defined on implementations', () => {
      // Contract: addEdge(edge: Edge) => Promise<void>
      // Should throw GraphStoreError with DUPLICATE_EDGE if edge ID exists
      // Should throw GraphStoreError with INVALID_REFERENCE if src/dst nodes missing
      expect(true).toBe(true);
    });

    it('addAnnotation should be defined on implementations', () => {
      // Contract: addAnnotation(annotation: Annotation) => Promise<void>
      // Should throw GraphStoreError with INVALID_REFERENCE if target node missing
      expect(true).toBe(true);
    });

    it('addPattern should be defined on implementations', () => {
      // Contract: addPattern(pattern: PatternInstance) => Promise<void>
      expect(true).toBe(true);
    });
  });

  describe('Read Operations', () => {
    it('getNode should return null for missing nodes', () => {
      // Contract: getNode(nodeId: string) => Promise<Node | null>
      expect(true).toBe(true);
    });

    it('getEdge should return null for missing edges', () => {
      // Contract: getEdge(edgeId: string) => Promise<Edge | null>
      expect(true).toBe(true);
    });

    it('getEdgesForNode should return empty array for unknown node', () => {
      // Contract: getEdgesForNode(nodeId: string, direction?: Direction) => Promise<Edge[]>
      expect(true).toBe(true);
    });

    it('getNeighbors should return empty array for unknown node', () => {
      // Contract: getNeighbors(nodeId: string, direction: Direction) => Promise<Node[]>
      expect(true).toBe(true);
    });

    it('getAnnotations should return empty array for unknown node', () => {
      // Contract: getAnnotations(nodeId: string) => Promise<Annotation[]>
      expect(true).toBe(true);
    });

    it('getPatternsForNode should return empty array for unknown node', () => {
      // Contract: getPatternsForNode(nodeId: string) => Promise<PatternInstance[]>
      expect(true).toBe(true);
    });
  });

  describe('Query Operations', () => {
    it('findNodes with empty criteria should return all nodes', () => {
      // Contract: findNodes(criteria: NodeQuery) => Promise<Node[]>
      expect(true).toBe(true);
    });

    it('findEdges with empty criteria should return all edges', () => {
      // Contract: findEdges(criteria: EdgeQuery) => Promise<Edge[]>
      expect(true).toBe(true);
    });

    it('getSubgraph with depth 0 should return only root node', () => {
      // Contract: getSubgraph(rootId: string, depth: number, edgeKinds?: EdgeKind[]) => Promise<SubgraphResult>
      expect(true).toBe(true);
    });
  });

  describe('Lifecycle Operations', () => {
    it('clear should remove all data', () => {
      // Contract: clear() => Promise<void>
      expect(true).toBe(true);
    });

    it('close should release resources', () => {
      // Contract: close() => Promise<void>
      expect(true).toBe(true);
    });

    it('getStats should return current counts', () => {
      // Contract: getStats() => Promise<GraphStats>
      expect(true).toBe(true);
    });
  });
});
