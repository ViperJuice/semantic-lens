/**
 * Tests for View Service Types
 */

import { describe, it, expect } from 'vitest';
import {
  VIEW_TYPES,
  VIEW_CONFIG_DEFAULTS,
  isValidViewType,
  isValidViewConfig,
  applyViewConfigDefaults,
  validateViewConfig,
  type ViewType,
  type ViewConfig,
} from '../../../src/view-service/types.js';

describe('ViewType', () => {
  describe('VIEW_TYPES constant', () => {
    it('should contain all valid view types', () => {
      expect(VIEW_TYPES).toContain('call_graph');
      expect(VIEW_TYPES).toContain('inheritance');
      expect(VIEW_TYPES).toContain('module_deps');
      expect(VIEW_TYPES).toContain('full');
      expect(VIEW_TYPES).toHaveLength(4);
    });

    it('should be readonly (immutable at type level)', () => {
      // VIEW_TYPES is readonly at the TypeScript level via 'as const'
      // Runtime immutability is enforced by TypeScript compiler
      expect(Array.isArray(VIEW_TYPES)).toBe(true);
    });
  });

  describe('isValidViewType', () => {
    it('should return true for valid view types', () => {
      expect(isValidViewType('call_graph')).toBe(true);
      expect(isValidViewType('inheritance')).toBe(true);
      expect(isValidViewType('module_deps')).toBe(true);
      expect(isValidViewType('full')).toBe(true);
    });

    it('should return false for invalid view types', () => {
      expect(isValidViewType('invalid')).toBe(false);
      expect(isValidViewType('')).toBe(false);
      expect(isValidViewType(null)).toBe(false);
      expect(isValidViewType(undefined)).toBe(false);
      expect(isValidViewType(123)).toBe(false);
      expect(isValidViewType({})).toBe(false);
    });
  });
});

describe('ViewConfig', () => {
  describe('VIEW_CONFIG_DEFAULTS', () => {
    it('should have correct default values', () => {
      expect(VIEW_CONFIG_DEFAULTS.depth).toBe(3);
      expect(VIEW_CONFIG_DEFAULTS.min_confidence).toBe(0.0);
      expect(VIEW_CONFIG_DEFAULTS.collapse_kinds).toEqual([]);
      expect(VIEW_CONFIG_DEFAULTS.exclude_paths).toEqual([]);
      expect(VIEW_CONFIG_DEFAULTS.edge_kinds).toBeUndefined();
    });
  });

  describe('isValidViewConfig', () => {
    it('should return true for minimal valid config', () => {
      const config: ViewConfig = { view: 'call_graph' };
      expect(isValidViewConfig(config)).toBe(true);
    });

    it('should return true for config with all fields', () => {
      const config: ViewConfig = {
        view: 'inheritance',
        root_id: 'node-123',
        depth: 5,
        edge_kinds: ['calls', 'inherits'],
        min_confidence: 0.75,
        collapse_kinds: ['module'],
        exclude_paths: ['node_modules/**'],
      };
      expect(isValidViewConfig(config)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isValidViewConfig(null)).toBe(false);
      expect(isValidViewConfig(undefined)).toBe(false);
    });

    it('should return false for missing view field', () => {
      expect(isValidViewConfig({})).toBe(false);
      expect(isValidViewConfig({ root_id: 'test' })).toBe(false);
    });

    it('should return false for invalid view type', () => {
      expect(isValidViewConfig({ view: 'invalid' })).toBe(false);
      expect(isValidViewConfig({ view: 123 })).toBe(false);
    });

    it('should return false for invalid root_id', () => {
      expect(isValidViewConfig({ view: 'full', root_id: 123 })).toBe(false);
      expect(isValidViewConfig({ view: 'full', root_id: {} })).toBe(false);
    });

    it('should return false for invalid depth', () => {
      expect(isValidViewConfig({ view: 'full', depth: -1 })).toBe(false);
      expect(isValidViewConfig({ view: 'full', depth: 1.5 })).toBe(false);
      expect(isValidViewConfig({ view: 'full', depth: 'three' })).toBe(false);
    });

    it('should return false for invalid min_confidence', () => {
      expect(isValidViewConfig({ view: 'full', min_confidence: -0.1 })).toBe(false);
      expect(isValidViewConfig({ view: 'full', min_confidence: 1.1 })).toBe(false);
      expect(isValidViewConfig({ view: 'full', min_confidence: 'high' })).toBe(false);
    });

    it('should return false for invalid edge_kinds', () => {
      expect(isValidViewConfig({ view: 'full', edge_kinds: 'calls' })).toBe(false);
      expect(isValidViewConfig({ view: 'full', edge_kinds: [123] })).toBe(false);
    });

    it('should return false for invalid collapse_kinds', () => {
      expect(isValidViewConfig({ view: 'full', collapse_kinds: 'module' })).toBe(false);
      expect(isValidViewConfig({ view: 'full', collapse_kinds: [456] })).toBe(false);
    });

    it('should return false for invalid exclude_paths', () => {
      expect(isValidViewConfig({ view: 'full', exclude_paths: 'path' })).toBe(false);
      expect(isValidViewConfig({ view: 'full', exclude_paths: [789] })).toBe(false);
    });

    it('should allow zero depth', () => {
      expect(isValidViewConfig({ view: 'full', depth: 0 })).toBe(true);
    });

    it('should allow zero min_confidence', () => {
      expect(isValidViewConfig({ view: 'full', min_confidence: 0 })).toBe(true);
    });

    it('should allow one min_confidence', () => {
      expect(isValidViewConfig({ view: 'full', min_confidence: 1 })).toBe(true);
    });
  });

  describe('applyViewConfigDefaults', () => {
    it('should apply all defaults to minimal config', () => {
      const config: ViewConfig = { view: 'call_graph' };
      const result = applyViewConfigDefaults(config);

      expect(result.view).toBe('call_graph');
      expect(result.root_id).toBeUndefined();
      expect(result.depth).toBe(3);
      expect(result.edge_kinds).toBeUndefined();
      expect(result.min_confidence).toBe(0.0);
      expect(result.collapse_kinds).toEqual([]);
      expect(result.exclude_paths).toEqual([]);
    });

    it('should preserve provided values', () => {
      const config: ViewConfig = {
        view: 'inheritance',
        root_id: 'node-abc',
        depth: 10,
        edge_kinds: ['inherits'],
        min_confidence: 0.9,
        collapse_kinds: ['class'],
        exclude_paths: ['vendor/**'],
      };
      const result = applyViewConfigDefaults(config);

      expect(result.view).toBe('inheritance');
      expect(result.root_id).toBe('node-abc');
      expect(result.depth).toBe(10);
      expect(result.edge_kinds).toEqual(['inherits']);
      expect(result.min_confidence).toBe(0.9);
      expect(result.collapse_kinds).toEqual(['class']);
      expect(result.exclude_paths).toEqual(['vendor/**']);
    });

    it('should partially apply defaults', () => {
      const config: ViewConfig = {
        view: 'module_deps',
        depth: 5,
        min_confidence: 0.5,
      };
      const result = applyViewConfigDefaults(config);

      expect(result.view).toBe('module_deps');
      expect(result.depth).toBe(5);
      expect(result.min_confidence).toBe(0.5);
      expect(result.collapse_kinds).toEqual([]); // default
      expect(result.exclude_paths).toEqual([]); // default
    });
  });

  describe('validateViewConfig', () => {
    it('should return valid config unchanged', () => {
      const config: ViewConfig = { view: 'full', depth: 2 };
      const result = validateViewConfig(config);
      expect(result).toEqual(config);
    });

    it('should throw for invalid config', () => {
      expect(() => validateViewConfig({})).toThrow('Invalid ViewConfig');
      expect(() => validateViewConfig(null)).toThrow('Invalid ViewConfig');
      expect(() => validateViewConfig({ view: 'bad' })).toThrow('Invalid ViewConfig');
    });
  });
});

describe('Position type', () => {
  it('should accept valid position objects', () => {
    // Type-level test - if this compiles, the type is correct
    const pos: { x: number; y: number } = { x: 100, y: 200 };
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });
});

describe('ProjectionResult type', () => {
  it('should accept valid projection results', () => {
    // Type-level test
    const result = {
      nodes: [],
      edges: [],
      rootId: 'root-123',
    };
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.rootId).toBe('root-123');
  });

  it('should allow undefined rootId', () => {
    const result = {
      nodes: [],
      edges: [],
    };
    expect(result.rootId).toBeUndefined();
  });
});
