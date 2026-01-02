/**
 * Tests for graph query utilities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
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
} from '../../../src/graph/queries';
import { loadBundleToStore } from '../../../src/graph/loader';
import { createInMemoryStore } from '../../../src/graph/memory-store';
import type { GraphStore } from '../../../src/graph/store';

// Import test fixtures
import smallGraph from '../../../fixtures/sample-graphs/small-graph.json';
import mediumGraph from '../../../fixtures/sample-graphs/medium-graph.json';
import patternRich from '../../../fixtures/sample-graphs/pattern-rich.json';

describe('Query utilities', () => {
  let store: GraphStore;

  beforeEach(async () => {
    store = createInMemoryStore();
  });

  describe('getPath', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, smallGraph);
    });

    it('should find direct path between connected nodes', async () => {
      // Find path from module to a class it defines
      const path = await getPath(store, 'mod-app-001', 'cls-user-002');

      expect(path).not.toBeNull();
      expect(path!.length).toBe(1);
      expect(path!.nodes[0]!.node_id).toBe('mod-app-001');
      expect(path!.nodes[1]!.node_id).toBe('cls-user-002');
    });

    it('should find multi-hop path', async () => {
      // Find path from module to method (2 hops)
      const path = await getPath(store, 'mod-app-001', 'mth-getuser-004');

      expect(path).not.toBeNull();
      expect(path!.length).toBe(2);
    });

    it('should return null for unconnected nodes', async () => {
      // Create a disconnected store
      const isolatedStore = createInMemoryStore();
      await isolatedStore.addNode({
        node_id: 'isolated-1',
        kind: 'class',
        name: 'Isolated1',
        language: 'typescript',
        file: 'iso1.ts',
        span: [0, 10],
      });
      await isolatedStore.addNode({
        node_id: 'isolated-2',
        kind: 'class',
        name: 'Isolated2',
        language: 'typescript',
        file: 'iso2.ts',
        span: [0, 10],
      });

      const path = await getPath(isolatedStore, 'isolated-1', 'isolated-2');
      expect(path).toBeNull();
    });

    it('should return trivial path for same node', async () => {
      const path = await getPath(store, 'mod-app-001', 'mod-app-001');

      expect(path).not.toBeNull();
      expect(path!.length).toBe(0);
      expect(path!.nodes).toHaveLength(1);
      expect(path!.edges).toHaveLength(0);
    });

    it('should return null for nonexistent source node', async () => {
      const path = await getPath(store, 'nonexistent', 'cls-user-002');
      expect(path).toBeNull();
    });

    it('should return null for nonexistent target node', async () => {
      const path = await getPath(store, 'mod-app-001', 'nonexistent');
      expect(path).toBeNull();
    });

    it('should respect maxDepth', async () => {
      // Path from mod-app-001 to mth-getuser-004 is 2 hops:
      // mod-app-001 -> cls-user-002 -> mth-getuser-004
      // So maxDepth=1 should be too short
      const shortPath = await getPath(store, 'mod-app-001', 'mth-getuser-004', 0);
      expect(shortPath).toBeNull();

      const longPath = await getPath(store, 'mod-app-001', 'mth-getuser-004', 2);
      expect(longPath).not.toBeNull();
      expect(longPath!.length).toBe(2);
    });

    it('should find shortest path', async () => {
      await loadBundleToStore(store, mediumGraph, { clearFirst: true });

      // Find path between two services
      const path = await getPath(store, 'cls-auth-005', 'cls-validator-012');

      // Should be the shortest path (likely 1 hop via imports)
      expect(path).not.toBeNull();
      expect(path!.length).toBeGreaterThan(0);
    });
  });

  describe('getConnectedComponent', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, smallGraph);
    });

    it('should return all connected nodes', async () => {
      const component = await getConnectedComponent(store, 'mod-app-001');

      // 9 nodes are connected (prop-name-010 is an orphan with no edges)
      expect(component.nodes.length).toBe(9);
    });

    it('should include edges in the component', async () => {
      const component = await getConnectedComponent(store, 'mod-app-001');

      expect(component.edges.length).toBe(10);
    });

    it('should return single node for isolated node', async () => {
      // Add an isolated node
      await store.addNode({
        node_id: 'isolated-node',
        kind: 'class',
        name: 'Isolated',
        language: 'typescript',
        file: 'iso.ts',
        span: [0, 10],
      });

      const component = await getConnectedComponent(store, 'isolated-node');

      expect(component.nodes).toHaveLength(1);
      expect(component.edges).toHaveLength(0);
    });
  });

  describe('findByRoute', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, smallGraph);
    });

    it('should find nodes by exact route', async () => {
      const nodes = await findByRoute(store, 'app.services.UserService');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.name).toBe('UserService');
    });

    it('should find nodes by wildcard (*) pattern', async () => {
      const nodes = await findByRoute(store, 'app.services.*');

      expect(nodes).toHaveLength(2); // UserService and OrderService
    });

    it('should find nodes by double wildcard (**) pattern', async () => {
      const nodes = await findByRoute(store, 'app.**');

      // Should match all nodes with routes starting with "app"
      expect(nodes.length).toBeGreaterThan(2);
    });

    it('should return empty array for no matches', async () => {
      const nodes = await findByRoute(store, 'nonexistent.*');

      expect(nodes).toHaveLength(0);
    });
  });

  describe('findByFile', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, smallGraph);
    });

    it('should find nodes in a specific file', async () => {
      const nodes = await findByFile(store, 'src/services/user.ts');

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.every((n) => n.file === 'src/services/user.ts')).toBe(true);
    });

    it('should return empty array for unknown file', async () => {
      const nodes = await findByFile(store, 'nonexistent.ts');

      expect(nodes).toHaveLength(0);
    });
  });

  describe('findByKind', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, smallGraph);
    });

    it('should find all classes', async () => {
      const classes = await findByKind(store, 'class');

      expect(classes.length).toBeGreaterThan(0);
      expect(classes.every((n) => n.kind === 'class')).toBe(true);
    });

    it('should find all methods', async () => {
      const methods = await findByKind(store, 'method');

      expect(methods.length).toBeGreaterThan(0);
      expect(methods.every((n) => n.kind === 'method')).toBe(true);
    });
  });

  describe('getCallers and getCallees', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, smallGraph);
    });

    it('should find callers of a method', async () => {
      const callers = await getCallers(store, 'mth-getuser-004');

      expect(callers.length).toBeGreaterThan(0);
    });

    it('should find callees of a method', async () => {
      const callees = await getCallees(store, 'mth-createorder-005');

      expect(callees.length).toBeGreaterThan(0);
    });

    it('should return empty array for method with no callers', async () => {
      // The createOrder method is not called by anything in this graph
      // Actually it calls others, so find one that isn't called
      const callers = await getCallers(store, 'mod-app-001');

      // Module is not called (calls is for functions/methods)
      expect(callers).toHaveLength(0);
    });
  });

  describe('getCallGraph', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, mediumGraph);
    });

    it('should return call graph from a method', async () => {
      const callGraph = await getCallGraph(store, 'mth-createorder-022', 3);

      expect(callGraph.nodes.length).toBeGreaterThan(0);
      // All edges should be 'calls' type
      expect(callGraph.edges.every((e) => e.kind === 'calls')).toBe(true);
    });

    it('should respect maxDepth', async () => {
      const depth1 = await getCallGraph(store, 'mth-createorder-022', 1);
      const depth3 = await getCallGraph(store, 'mth-createorder-022', 3);

      expect(depth3.nodes.length).toBeGreaterThanOrEqual(depth1.nodes.length);
    });
  });

  describe('findOrphanNodes', () => {
    it('should find nodes with no edges', async () => {
      // Add an orphan node
      await store.addNode({
        node_id: 'orphan-1',
        kind: 'class',
        name: 'Orphan',
        language: 'typescript',
        file: 'orphan.ts',
        span: [0, 10],
      });

      const orphans = await findOrphanNodes(store);

      expect(orphans.length).toBeGreaterThan(0);
      expect(orphans.some((n) => n.node_id === 'orphan-1')).toBe(true);
    });

    it('should include the orphan node from small graph', async () => {
      await loadBundleToStore(store, smallGraph);

      const orphans = await findOrphanNodes(store);

      // prop-name-010 has no edges in small graph
      expect(orphans).toHaveLength(1);
      expect(orphans[0]!.node_id).toBe('prop-name-010');
    });
  });

  describe('findConnectedNodes', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, mediumGraph);
    });

    it('should find nodes with both incoming and outgoing edges', async () => {
      const connected = await findConnectedNodes(store);

      // There should be some connected nodes
      expect(connected.length).toBeGreaterThan(0);

      // Each connected node should have both in and out edges
      for (const node of connected) {
        const inEdges = await store.getEdgesForNode(node.node_id, 'in');
        const outEdges = await store.getEdgesForNode(node.node_id, 'out');

        expect(inEdges.length).toBeGreaterThan(0);
        expect(outEdges.length).toBeGreaterThan(0);
      }
    });
  });

  describe('with pattern-rich graph', () => {
    beforeEach(async () => {
      await loadBundleToStore(store, patternRich);
    });

    it('should find Observer pattern components by route', async () => {
      const observers = await findByRoute(store, 'patterns.observer.*');

      expect(observers.length).toBeGreaterThan(0);
    });

    it('should find path between pattern components', async () => {
      // Find path from subject to observer
      const path = await getPath(store, 'cls-subject-002', 'cls-logobserver-004');

      expect(path).not.toBeNull();
    });
  });
});
