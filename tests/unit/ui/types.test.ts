/**
 * UI Types Tests
 * Tests for LensConfig validation and applyLensFilter functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LENS_CONFIG,
  isValidLensConfig,
  applyLensFilter,
  type LensConfig,
} from '../../../src/ui/types.js';
import type { CytoscapeElements } from '../../../src/view-service/formatter/formatter.js';

describe('LensConfig', () => {
  describe('DEFAULT_LENS_CONFIG', () => {
    it('should have all edge kinds enabled by default', () => {
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('calls');
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('inherits');
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('implements');
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('defines');
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('imports');
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('uses');
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('reads');
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('writes');
      expect(DEFAULT_LENS_CONFIG.edgeKinds).toContain('throws');
    });

    it('should have minConfidence set to 0', () => {
      expect(DEFAULT_LENS_CONFIG.minConfidence).toBe(0.0);
    });

    it('should have showPatterns enabled by default', () => {
      expect(DEFAULT_LENS_CONFIG.showPatterns).toBe(true);
    });

    it('should have empty patternFilter array', () => {
      expect(DEFAULT_LENS_CONFIG.patternFilter).toEqual([]);
    });

    it('should have empty nodeKinds array (all kinds shown)', () => {
      expect(DEFAULT_LENS_CONFIG.nodeKinds).toEqual([]);
    });
  });

  describe('isValidLensConfig', () => {
    it('should return true for valid LensConfig', () => {
      const config: LensConfig = {
        edgeKinds: ['calls', 'inherits'],
        minConfidence: 0.5,
        showPatterns: true,
        patternFilter: ['observer'],
        nodeKinds: ['class', 'method'],
      };
      expect(isValidLensConfig(config)).toBe(true);
    });

    it('should return true for DEFAULT_LENS_CONFIG', () => {
      expect(isValidLensConfig(DEFAULT_LENS_CONFIG)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidLensConfig(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidLensConfig(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidLensConfig('string')).toBe(false);
      expect(isValidLensConfig(42)).toBe(false);
    });

    it('should return false if edgeKinds is not an array', () => {
      const config = {
        edgeKinds: 'calls',
        minConfidence: 0.5,
        showPatterns: true,
      };
      expect(isValidLensConfig(config)).toBe(false);
    });

    it('should return false if minConfidence is out of range', () => {
      const config = {
        edgeKinds: ['calls'],
        minConfidence: 1.5,
        showPatterns: true,
      };
      expect(isValidLensConfig(config)).toBe(false);
    });

    it('should return false if minConfidence is negative', () => {
      const config = {
        edgeKinds: ['calls'],
        minConfidence: -0.1,
        showPatterns: true,
      };
      expect(isValidLensConfig(config)).toBe(false);
    });

    it('should return false if showPatterns is not a boolean', () => {
      const config = {
        edgeKinds: ['calls'],
        minConfidence: 0.5,
        showPatterns: 'yes',
      };
      expect(isValidLensConfig(config)).toBe(false);
    });
  });
});

describe('applyLensFilter', () => {
  const createTestElements = (): CytoscapeElements => ({
    nodes: [
      {
        data: { id: 'node1', label: 'Class1', kind: 'class' },
        classes: 'node-class',
      },
      {
        data: { id: 'node2', label: 'Method1', kind: 'method' },
        classes: 'node-method',
      },
      {
        data: { id: 'node3', label: 'Function1', kind: 'function' },
        classes: 'node-function',
      },
    ],
    edges: [
      {
        data: { id: 'edge1', source: 'node1', target: 'node2', kind: 'defines', confidence: 0.9 },
        classes: 'edge-defines',
      },
      {
        data: { id: 'edge2', source: 'node2', target: 'node3', kind: 'calls', confidence: 0.7 },
        classes: 'edge-calls',
      },
      {
        data: { id: 'edge3', source: 'node1', target: 'node3', kind: 'uses', confidence: 0.3 },
        classes: 'edge-uses',
      },
    ],
  });

  it('should return all elements when using DEFAULT_LENS_CONFIG', () => {
    const elements = createTestElements();
    const filtered = applyLensFilter(elements, DEFAULT_LENS_CONFIG);
    expect(filtered.nodes).toHaveLength(3);
    expect(filtered.edges).toHaveLength(3);
  });

  it('should filter edges by kind', () => {
    const elements = createTestElements();
    const config: LensConfig = {
      edgeKinds: ['calls'],
      minConfidence: 0.0,
      showPatterns: true,
    };
    const filtered = applyLensFilter(elements, config);
    expect(filtered.edges).toHaveLength(1);
    expect(filtered.edges[0].data.kind).toBe('calls');
  });

  it('should filter edges by minConfidence', () => {
    const elements = createTestElements();
    const config: LensConfig = {
      edgeKinds: ['defines', 'calls', 'uses'],
      minConfidence: 0.5,
      showPatterns: true,
    };
    const filtered = applyLensFilter(elements, config);
    expect(filtered.edges).toHaveLength(2);
    expect(filtered.edges.every((e) => e.data.confidence >= 0.5)).toBe(true);
  });

  it('should filter nodes by kind when nodeKinds is specified', () => {
    const elements = createTestElements();
    const config: LensConfig = {
      edgeKinds: ['defines', 'calls', 'uses'],
      minConfidence: 0.0,
      showPatterns: true,
      nodeKinds: ['class', 'method'],
    };
    const filtered = applyLensFilter(elements, config);
    expect(filtered.nodes).toHaveLength(2);
    expect(filtered.nodes.every((n) => ['class', 'method'].includes(n.data.kind))).toBe(true);
  });

  it('should keep all nodes when nodeKinds is empty', () => {
    const elements = createTestElements();
    const config: LensConfig = {
      edgeKinds: ['defines', 'calls', 'uses'],
      minConfidence: 0.0,
      showPatterns: true,
      nodeKinds: [],
    };
    const filtered = applyLensFilter(elements, config);
    expect(filtered.nodes).toHaveLength(3);
  });

  it('should remove edges whose source or target nodes are filtered out', () => {
    const elements = createTestElements();
    const config: LensConfig = {
      edgeKinds: ['defines', 'calls', 'uses'],
      minConfidence: 0.0,
      showPatterns: true,
      nodeKinds: ['class'], // Only keep node1
    };
    const filtered = applyLensFilter(elements, config);
    expect(filtered.nodes).toHaveLength(1);
    // All edges should be removed since they reference nodes not in the filtered set
    expect(filtered.edges).toHaveLength(0);
  });

  it('should handle empty elements', () => {
    const elements: CytoscapeElements = { nodes: [], edges: [] };
    const filtered = applyLensFilter(elements, DEFAULT_LENS_CONFIG);
    expect(filtered.nodes).toHaveLength(0);
    expect(filtered.edges).toHaveLength(0);
  });

  it('should combine edge kind and confidence filters', () => {
    const elements = createTestElements();
    const config: LensConfig = {
      edgeKinds: ['defines', 'uses'], // Excludes 'calls' edge
      minConfidence: 0.5, // Excludes 'uses' edge (0.3)
      showPatterns: true,
    };
    const filtered = applyLensFilter(elements, config);
    expect(filtered.edges).toHaveLength(1);
    expect(filtered.edges[0].data.kind).toBe('defines');
    expect(filtered.edges[0].data.confidence).toBe(0.9);
  });
});
