/**
 * Pattern Overlay Tests
 * Tests for pattern visualization with convex hulls and highlights.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createPatternOverlayManager,
  calculateConvexHull,
  getPatternNodeIds,
  type PatternOverlayManager,
} from '../../../src/ui/overlays/pattern-overlay.js';
import type { PatternMatch } from '../../../src/patterns/types.js';

const createTestPatterns = (): PatternMatch[] => [
  {
    instanceId: 'observer-1',
    patternId: 'observer',
    roles: { subject: 'node1', observer: ['node2', 'node3'] },
    confidence: 0.9,
    evidence: ['calls update method'],
  },
  {
    instanceId: 'strategy-1',
    patternId: 'strategy',
    roles: { context: 'node4', strategy: 'node5' },
    confidence: 0.85,
    evidence: ['implements interface'],
  },
];

// Mock Cytoscape instance
const createMockCytoscape = () => {
  const mockNodes = new Map<string, { addClass: ReturnType<typeof vi.fn>; removeClass: ReturnType<typeof vi.fn>; position: () => { x: number; y: number } }>();

  // Create mock nodes
  ['node1', 'node2', 'node3', 'node4', 'node5'].forEach((id, i) => {
    mockNodes.set(id, {
      addClass: vi.fn(),
      removeClass: vi.fn(),
      position: () => ({ x: i * 100, y: i * 50 }),
    });
  });

  // Create mock edges
  const mockEdges = [
    { id: 'e1', source: 'node1', target: 'node2' },
    { id: 'e2', source: 'node2', target: 'node3' },
  ];

  return {
    nodes: vi.fn(() => ({
      forEach: vi.fn((fn: (node: unknown) => void) => {
        mockNodes.forEach((node, id) => {
          fn({ id: () => id, ...node });
        });
      }),
    })),
    edges: vi.fn(() => ({
      forEach: vi.fn((fn: (edge: unknown) => void) => {
        mockEdges.forEach((edge) => {
          fn({
            id: () => edge.id,
            source: () => ({ id: () => edge.source }),
            target: () => ({ id: () => edge.target }),
            addClass: vi.fn(),
            removeClass: vi.fn(),
          });
        });
      }),
    })),
    getElementById: vi.fn((id: string) => {
      const node = mockNodes.get(id);
      return {
        length: node ? 1 : 0,
        position: node?.position || (() => ({ x: 0, y: 0 })),
        addClass: node?.addClass || vi.fn(),
        removeClass: node?.removeClass || vi.fn(),
      };
    }),
    elements: vi.fn(() => ({
      removeClass: vi.fn(),
    })),
  };
};

describe('createPatternOverlayManager', () => {
  it('should create a PatternOverlayManager instance', () => {
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
    });

    expect(manager).toBeDefined();
    expect(typeof manager.apply).toBe('function');
    expect(typeof manager.update).toBe('function');
    expect(typeof manager.clear).toBe('function');
    expect(typeof manager.highlight).toBe('function');
    expect(typeof manager.clearHighlight).toBe('function');
    expect(typeof manager.getPatternNodes).toBe('function');
  });

  it('should return pattern nodes', () => {
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
    });

    const nodes = manager.getPatternNodes();
    expect(nodes).toBeInstanceOf(Set);
    expect(nodes.has('node1')).toBe(true);
    expect(nodes.has('node2')).toBe(true);
    expect(nodes.has('node3')).toBe(true);
    expect(nodes.has('node4')).toBe(true);
    expect(nodes.has('node5')).toBe(true);
  });

  it('should apply overlays to cytoscape instance', () => {
    const cy = createMockCytoscape();
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
    });

    expect(() => manager.apply(cy)).not.toThrow();
  });

  it('should clear overlays', () => {
    const cy = createMockCytoscape();
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
    });

    manager.apply(cy);
    expect(() => manager.clear()).not.toThrow();
  });

  it('should highlight a pattern', () => {
    const cy = createMockCytoscape();
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
    });

    manager.apply(cy);
    expect(() => manager.highlight('observer-1')).not.toThrow();
  });

  it('should clear highlight', () => {
    const cy = createMockCytoscape();
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
    });

    manager.apply(cy);
    manager.highlight('observer-1');
    expect(() => manager.clearHighlight()).not.toThrow();
  });

  it('should update configuration', () => {
    const manager = createPatternOverlayManager({
      patterns: [],
    });

    manager.update({ patterns: createTestPatterns() });
    const nodes = manager.getPatternNodes();
    expect(nodes.size).toBe(5);
  });
});

describe('calculateConvexHull', () => {
  it('should return empty array for empty input', () => {
    const hull = calculateConvexHull([]);
    expect(hull).toEqual([]);
  });

  it('should return single point for single input', () => {
    const hull = calculateConvexHull([{ x: 10, y: 20 }]);
    expect(hull).toHaveLength(1);
    expect(hull[0]).toEqual({ x: 10, y: 20 });
  });

  it('should return both points for two inputs', () => {
    const hull = calculateConvexHull([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(hull).toHaveLength(2);
  });

  it('should calculate convex hull for triangle', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    const hull = calculateConvexHull(points);
    expect(hull).toHaveLength(3);
  });

  it('should calculate convex hull for square', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const hull = calculateConvexHull(points);
    expect(hull).toHaveLength(4);
  });

  it('should exclude interior points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 }, // Interior point
    ];
    const hull = calculateConvexHull(points);
    expect(hull).toHaveLength(4);
    // Interior point should not be in hull
    const hasInterior = hull.some((p) => p.x === 5 && p.y === 5);
    expect(hasInterior).toBe(false);
  });

  it('should handle collinear points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    const hull = calculateConvexHull(points);
    // Should return the extreme points
    expect(hull.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getPatternNodeIds', () => {
  it('should extract all node IDs from pattern', () => {
    const pattern: PatternMatch = {
      instanceId: 'test-1',
      patternId: 'observer',
      roles: { subject: 'node1', observer: ['node2', 'node3'] },
      confidence: 0.9,
      evidence: [],
    };

    const nodeIds = getPatternNodeIds(pattern);
    expect(nodeIds).toContain('node1');
    expect(nodeIds).toContain('node2');
    expect(nodeIds).toContain('node3');
    expect(nodeIds).toHaveLength(3);
  });

  it('should handle single-node roles', () => {
    const pattern: PatternMatch = {
      instanceId: 'test-1',
      patternId: 'singleton',
      roles: { class: 'node1' },
      confidence: 0.95,
      evidence: [],
    };

    const nodeIds = getPatternNodeIds(pattern);
    expect(nodeIds).toContain('node1');
    expect(nodeIds).toHaveLength(1);
  });

  it('should handle empty roles', () => {
    const pattern: PatternMatch = {
      instanceId: 'test-1',
      patternId: 'empty',
      roles: {},
      confidence: 0.5,
      evidence: [],
    };

    const nodeIds = getPatternNodeIds(pattern);
    expect(nodeIds).toHaveLength(0);
  });

  it('should handle mixed single and array roles', () => {
    const pattern: PatternMatch = {
      instanceId: 'test-1',
      patternId: 'strategy',
      roles: {
        context: 'ctx1',
        strategy: 'strat1',
        implementations: ['impl1', 'impl2', 'impl3'],
      },
      confidence: 0.8,
      evidence: [],
    };

    const nodeIds = getPatternNodeIds(pattern);
    expect(nodeIds).toHaveLength(5);
    expect(nodeIds).toContain('ctx1');
    expect(nodeIds).toContain('strat1');
    expect(nodeIds).toContain('impl1');
    expect(nodeIds).toContain('impl2');
    expect(nodeIds).toContain('impl3');
  });
});

describe('PatternOverlayManager hull styles', () => {
  it('should accept custom hull styles', () => {
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
      hullStyle: {
        fillColor: '#ff0000',
        strokeColor: '#0000ff',
        strokeWidth: 3,
        opacity: 0.5,
      },
    });

    expect(manager).toBeDefined();
  });

  it('should accept showLabels option', () => {
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
      showLabels: true,
    });

    expect(manager).toBeDefined();
  });

  it('should accept highlightedInstance option', () => {
    const manager = createPatternOverlayManager({
      patterns: createTestPatterns(),
      highlightedInstance: 'observer-1',
    });

    expect(manager).toBeDefined();
  });
});
