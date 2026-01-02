/**
 * Tests for ELK Layout Client
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createELKLayoutEngine,
  findConnectedComponents,
  layoutWithComponents,
  type ELKLayoutEngine,
} from '../../../src/view-service/layout/elk-client.js';
import type { Node, Edge } from '../../../src/schema/types.js';

describe('ELKLayoutEngine', () => {
  let engine: ELKLayoutEngine;

  const sampleNodes: Node[] = [
    {
      node_id: 'node-a',
      kind: 'class',
      name: 'ClassA',
      language: 'typescript',
      file: 'src/a.ts',
      span: [0, 100],
    },
    {
      node_id: 'node-b',
      kind: 'class',
      name: 'ClassB',
      language: 'typescript',
      file: 'src/b.ts',
      span: [0, 100],
    },
    {
      node_id: 'node-c',
      kind: 'class',
      name: 'ClassC',
      language: 'typescript',
      file: 'src/c.ts',
      span: [0, 100],
    },
  ];

  const sampleEdges: Edge[] = [
    {
      edge_id: 'edge-1',
      kind: 'inherits',
      src: 'node-a',
      dst: 'node-b',
      confidence: 1.0,
      evidence: ['static_analysis'],
    },
    {
      edge_id: 'edge-2',
      kind: 'calls',
      src: 'node-b',
      dst: 'node-c',
      confidence: 0.9,
      evidence: ['static_analysis'],
    },
  ];

  beforeEach(() => {
    engine = createELKLayoutEngine();
  });

  describe('createELKLayoutEngine', () => {
    it('should create an engine instance', () => {
      expect(engine).toBeDefined();
      expect(typeof engine.layout).toBe('function');
      expect(typeof engine.layoutComponent).toBe('function');
    });
  });

  describe('layout', () => {
    it('should produce positions for all nodes', async () => {
      const positions = await engine.layout(sampleNodes, sampleEdges);

      expect(Object.keys(positions)).toHaveLength(3);
      expect(positions['node-a']).toBeDefined();
      expect(positions['node-b']).toBeDefined();
      expect(positions['node-c']).toBeDefined();
    });

    it('should produce valid position coordinates', async () => {
      const positions = await engine.layout(sampleNodes, sampleEdges);

      for (const pos of Object.values(positions)) {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
      }
    });

    it('should produce deterministic output', async () => {
      const positions1 = await engine.layout(sampleNodes, sampleEdges);
      const positions2 = await engine.layout(sampleNodes, sampleEdges);

      expect(positions1).toEqual(positions2);
    });

    it('should handle empty graph', async () => {
      const positions = await engine.layout([], []);
      expect(positions).toEqual({});
    });

    it('should handle single node', async () => {
      const positions = await engine.layout([sampleNodes[0]!], []);

      expect(Object.keys(positions)).toHaveLength(1);
      expect(positions['node-a']).toEqual({ x: 0, y: 0 });
    });

    it('should handle graph with no edges', async () => {
      const positions = await engine.layout(sampleNodes, []);

      expect(Object.keys(positions)).toHaveLength(3);
      for (const pos of Object.values(positions)) {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
      }
    });

    it('should ignore edges with missing nodes', async () => {
      const edgesWithMissing: Edge[] = [
        ...sampleEdges,
        {
          edge_id: 'edge-missing',
          kind: 'calls',
          src: 'node-a',
          dst: 'node-nonexistent',
          confidence: 1.0,
          evidence: ['static_analysis'],
        },
      ];

      // Should not throw
      const positions = await engine.layout(sampleNodes, edgesWithMissing);
      expect(Object.keys(positions)).toHaveLength(3);
    });
  });

  describe('layoutComponent', () => {
    it('should work the same as layout for a single component', async () => {
      const layoutPositions = await engine.layout(sampleNodes, sampleEdges);
      const componentPositions = await engine.layoutComponent(sampleNodes, sampleEdges);

      expect(layoutPositions).toEqual(componentPositions);
    });
  });
});

describe('findConnectedComponents', () => {
  it('should find single component when all nodes connected', () => {
    const nodes: Node[] = [
      { node_id: 'a', kind: 'class', name: 'A', language: 'ts', file: 'a.ts', span: [0, 1] },
      { node_id: 'b', kind: 'class', name: 'B', language: 'ts', file: 'b.ts', span: [0, 1] },
      { node_id: 'c', kind: 'class', name: 'C', language: 'ts', file: 'c.ts', span: [0, 1] },
    ];
    const edges: Edge[] = [
      { edge_id: 'e1', kind: 'calls', src: 'a', dst: 'b', confidence: 1, evidence: ['static_analysis'] },
      { edge_id: 'e2', kind: 'calls', src: 'b', dst: 'c', confidence: 1, evidence: ['static_analysis'] },
    ];

    const components = findConnectedComponents(nodes, edges);

    expect(components).toHaveLength(1);
    expect(components[0]!.nodes).toHaveLength(3);
    expect(components[0]!.edges).toHaveLength(2);
  });

  it('should find multiple components', () => {
    const nodes: Node[] = [
      { node_id: 'a', kind: 'class', name: 'A', language: 'ts', file: 'a.ts', span: [0, 1] },
      { node_id: 'b', kind: 'class', name: 'B', language: 'ts', file: 'b.ts', span: [0, 1] },
      { node_id: 'c', kind: 'class', name: 'C', language: 'ts', file: 'c.ts', span: [0, 1] },
      { node_id: 'd', kind: 'class', name: 'D', language: 'ts', file: 'd.ts', span: [0, 1] },
    ];
    const edges: Edge[] = [
      { edge_id: 'e1', kind: 'calls', src: 'a', dst: 'b', confidence: 1, evidence: ['static_analysis'] },
      { edge_id: 'e2', kind: 'calls', src: 'c', dst: 'd', confidence: 1, evidence: ['static_analysis'] },
    ];

    const components = findConnectedComponents(nodes, edges);

    expect(components).toHaveLength(2);
    expect(components[0]!.nodes).toHaveLength(2);
    expect(components[1]!.nodes).toHaveLength(2);
  });

  it('should handle isolated nodes as separate components', () => {
    const nodes: Node[] = [
      { node_id: 'a', kind: 'class', name: 'A', language: 'ts', file: 'a.ts', span: [0, 1] },
      { node_id: 'b', kind: 'class', name: 'B', language: 'ts', file: 'b.ts', span: [0, 1] },
      { node_id: 'c', kind: 'class', name: 'C', language: 'ts', file: 'c.ts', span: [0, 1] },
    ];
    const edges: Edge[] = [];

    const components = findConnectedComponents(nodes, edges);

    expect(components).toHaveLength(3);
    for (const comp of components) {
      expect(comp.nodes).toHaveLength(1);
      expect(comp.edges).toHaveLength(0);
    }
  });

  it('should handle empty input', () => {
    const components = findConnectedComponents([], []);
    expect(components).toEqual([]);
  });
});

describe('layoutWithComponents', () => {
  it('should layout multiple components with spacing', async () => {
    const engine = createELKLayoutEngine();
    const nodes: Node[] = [
      { node_id: 'a', kind: 'class', name: 'A', language: 'ts', file: 'a.ts', span: [0, 1] },
      { node_id: 'b', kind: 'class', name: 'B', language: 'ts', file: 'b.ts', span: [0, 1] },
      { node_id: 'c', kind: 'class', name: 'C', language: 'ts', file: 'c.ts', span: [0, 1] },
      { node_id: 'd', kind: 'class', name: 'D', language: 'ts', file: 'd.ts', span: [0, 1] },
    ];
    const edges: Edge[] = [
      { edge_id: 'e1', kind: 'calls', src: 'a', dst: 'b', confidence: 1, evidence: ['static_analysis'] },
      // c and d are separate (no edges to a,b)
    ];

    const positions = await layoutWithComponents(engine, nodes, edges, 100);

    expect(Object.keys(positions)).toHaveLength(4);

    // All positions should be valid
    for (const pos of Object.values(positions)) {
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }
  });

  it('should handle empty input', async () => {
    const engine = createELKLayoutEngine();
    const positions = await layoutWithComponents(engine, [], []);
    expect(positions).toEqual({});
  });
});
