/**
 * Tests for Cytoscape Formatter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createFormatter,
  type CytoscapeFormatter,
  type CytoscapeElements,
} from '../../../src/view-service/formatter/formatter.js';
import type { Node, Edge } from '../../../src/schema/types.js';
import type { PatternMatch } from '../../../src/patterns/types.js';

describe('CytoscapeFormatter', () => {
  let formatter: CytoscapeFormatter;

  const sampleNodes: Node[] = [
    {
      node_id: 'node-class-a',
      kind: 'class',
      name: 'ClassA',
      language: 'typescript',
      file: 'src/a.ts',
      span: [0, 100],
      visibility: 'public',
      route: 'src/a.ts::ClassA',
    },
    {
      node_id: 'node-method-b',
      kind: 'method',
      name: 'methodB',
      language: 'typescript',
      file: 'src/a.ts',
      span: [50, 80],
      parent: 'node-class-a',
      signature: '(x: number) => string',
    },
    {
      node_id: 'node-func-c',
      kind: 'function',
      name: 'funcC',
      language: 'typescript',
      file: 'src/utils.ts',
      span: [0, 50],
    },
  ];

  const sampleEdges: Edge[] = [
    {
      edge_id: 'edge-1',
      kind: 'calls',
      src: 'node-method-b',
      dst: 'node-func-c',
      confidence: 0.95,
      evidence: ['static_analysis'],
    },
    {
      edge_id: 'edge-2',
      kind: 'defines',
      src: 'node-class-a',
      dst: 'node-method-b',
      confidence: 1.0,
      evidence: ['static_analysis'],
    },
  ];

  beforeEach(() => {
    formatter = createFormatter();
  });

  describe('createFormatter', () => {
    it('should create a formatter instance', () => {
      expect(formatter).toBeDefined();
      expect(typeof formatter.format).toBe('function');
      expect(typeof formatter.applyPositions).toBe('function');
      expect(typeof formatter.applyPatternOverlay).toBe('function');
    });
  });

  describe('format', () => {
    it('should convert nodes to Cytoscape format', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);

      expect(elements.nodes).toHaveLength(3);

      const classNode = elements.nodes.find((n) => n.data.id === 'node-class-a');
      expect(classNode).toBeDefined();
      expect(classNode!.data.label).toBe('ClassA');
      expect(classNode!.data.kind).toBe('class');
      expect(classNode!.data.file).toBe('src/a.ts');
      expect(classNode!.data.visibility).toBe('public');
      expect(classNode!.data.route).toBe('src/a.ts::ClassA');
      expect(classNode!.classes).toContain('node-class');
    });

    it('should convert edges to Cytoscape format', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);

      expect(elements.edges).toHaveLength(2);

      const callsEdge = elements.edges.find((e) => e.data.id === 'edge-1');
      expect(callsEdge).toBeDefined();
      expect(callsEdge!.data.source).toBe('node-method-b');
      expect(callsEdge!.data.target).toBe('node-func-c');
      expect(callsEdge!.data.kind).toBe('calls');
      expect(callsEdge!.data.confidence).toBe(0.95);
      expect(callsEdge!.classes).toContain('edge-calls');
    });

    it('should preserve parent relationships', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);

      const methodNode = elements.nodes.find((n) => n.data.id === 'node-method-b');
      expect(methodNode!.data.parent).toBe('node-class-a');
    });

    it('should preserve signature', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);

      const methodNode = elements.nodes.find((n) => n.data.id === 'node-method-b');
      expect(methodNode!.data.signature).toBe('(x: number) => string');
    });

    it('should assign correct CSS classes based on kind', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);

      expect(elements.nodes.find((n) => n.data.kind === 'class')!.classes).toBe('node-class');
      expect(elements.nodes.find((n) => n.data.kind === 'method')!.classes).toBe('node-method');
      expect(elements.nodes.find((n) => n.data.kind === 'function')!.classes).toBe('node-function');

      expect(elements.edges.find((e) => e.data.kind === 'calls')!.classes).toBe('edge-calls');
      expect(elements.edges.find((e) => e.data.kind === 'defines')!.classes).toBe('edge-defines');
    });

    it('should handle empty input', () => {
      const elements = formatter.format([], []);

      expect(elements.nodes).toEqual([]);
      expect(elements.edges).toEqual([]);
    });

    it('should include language in node data', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);

      const node = elements.nodes[0]!;
      expect(node.data.language).toBe('typescript');
    });
  });

  describe('applyPositions', () => {
    it('should apply positions to nodes', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const positions = {
        'node-class-a': { x: 100, y: 200 },
        'node-method-b': { x: 150, y: 300 },
        'node-func-c': { x: 200, y: 400 },
      };

      const withPositions = formatter.applyPositions(elements, positions);

      expect(withPositions.nodes[0]!.position).toEqual({ x: 100, y: 200 });
      expect(withPositions.nodes[1]!.position).toEqual({ x: 150, y: 300 });
      expect(withPositions.nodes[2]!.position).toEqual({ x: 200, y: 400 });
    });

    it('should not modify nodes without positions', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const positions = {
        'node-class-a': { x: 100, y: 200 },
        // node-method-b and node-func-c not included
      };

      const withPositions = formatter.applyPositions(elements, positions);

      expect(withPositions.nodes[0]!.position).toBeDefined();
      expect(withPositions.nodes[1]!.position).toBeUndefined();
      expect(withPositions.nodes[2]!.position).toBeUndefined();
    });

    it('should not modify edges', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const positions = { 'node-class-a': { x: 100, y: 200 } };

      const withPositions = formatter.applyPositions(elements, positions);

      expect(withPositions.edges).toEqual(elements.edges);
    });

    it('should handle empty positions', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const withPositions = formatter.applyPositions(elements, {});

      for (const node of withPositions.nodes) {
        expect(node.position).toBeUndefined();
      }
    });
  });

  describe('applyPatternOverlay', () => {
    it('should add pattern classes to nodes', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const patterns: PatternMatch[] = [
        {
          instanceId: 'match-1',
          patternId: 'Observer',
          roles: {
            subject: 'node-class-a',
            observer: 'node-func-c',
          },
          confidence: 0.9,
          evidence: ['Found notification method'],
        },
      ];

      const withPatterns = formatter.applyPatternOverlay(elements, patterns);

      const classNode = withPatterns.nodes.find((n) => n.data.id === 'node-class-a');
      expect(classNode!.classes).toContain('pattern-member');
      expect(classNode!.classes).toContain('pattern-observer');

      const funcNode = withPatterns.nodes.find((n) => n.data.id === 'node-func-c');
      expect(funcNode!.classes).toContain('pattern-member');
      expect(funcNode!.classes).toContain('pattern-observer');
    });

    it('should not modify nodes not in patterns', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const patterns: PatternMatch[] = [
        {
          instanceId: 'match-1',
          patternId: 'Singleton',
          roles: {
            singleton: 'node-class-a',
          },
          confidence: 0.85,
          evidence: ['Single instance'],
        },
      ];

      const withPatterns = formatter.applyPatternOverlay(elements, patterns);

      const methodNode = withPatterns.nodes.find((n) => n.data.id === 'node-method-b');
      expect(methodNode!.classes).not.toContain('pattern-member');
    });

    it('should handle array role bindings', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const patterns: PatternMatch[] = [
        {
          instanceId: 'match-1',
          patternId: 'Observer',
          roles: {
            observers: ['node-method-b', 'node-func-c'],
          },
          confidence: 0.8,
          evidence: ['Multiple observers'],
        },
      ];

      const withPatterns = formatter.applyPatternOverlay(elements, patterns);

      const methodNode = withPatterns.nodes.find((n) => n.data.id === 'node-method-b');
      expect(methodNode!.classes).toContain('pattern-member');

      const funcNode = withPatterns.nodes.find((n) => n.data.id === 'node-func-c');
      expect(funcNode!.classes).toContain('pattern-member');
    });

    it('should handle multiple patterns for same node', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const patterns: PatternMatch[] = [
        {
          instanceId: 'match-1',
          patternId: 'Observer',
          roles: { subject: 'node-class-a' },
          confidence: 0.9,
          evidence: [],
        },
        {
          instanceId: 'match-2',
          patternId: 'Factory',
          roles: { factory: 'node-class-a' },
          confidence: 0.85,
          evidence: [],
        },
      ];

      const withPatterns = formatter.applyPatternOverlay(elements, patterns);

      const classNode = withPatterns.nodes.find((n) => n.data.id === 'node-class-a');
      expect(classNode!.classes).toContain('pattern-observer');
      expect(classNode!.classes).toContain('pattern-factory');
    });

    it('should handle empty patterns', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const withPatterns = formatter.applyPatternOverlay(elements, []);

      for (const node of withPatterns.nodes) {
        expect(node.classes).not.toContain('pattern-member');
      }
    });

    it('should not modify edges', () => {
      const elements = formatter.format(sampleNodes, sampleEdges);
      const patterns: PatternMatch[] = [
        {
          instanceId: 'match-1',
          patternId: 'Observer',
          roles: { subject: 'node-class-a' },
          confidence: 0.9,
          evidence: [],
        },
      ];

      const withPatterns = formatter.applyPatternOverlay(elements, patterns);
      expect(withPatterns.edges).toEqual(elements.edges);
    });
  });
});
