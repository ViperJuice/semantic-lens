import { describe, it, expect } from 'vitest';
import {
  validateBundle,
  isValidBundle,
  getValidator,
  formatErrors,
} from '../../../src/schema/validator';

// Import test fixtures
import validBundle from '../../../fixtures/valid-bundle.json';
import invalidBundle from '../../../fixtures/invalid-bundle.json';
import minimalBundle from '../../../fixtures/minimal-bundle.json';

describe('validateBundle', () => {
  describe('with valid bundles', () => {
    it('should validate a complete valid bundle', () => {
      const result = validateBundle(validBundle);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate a minimal valid bundle', () => {
      const result = validateBundle(minimalBundle);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('with invalid bundles', () => {
    it('should reject an invalid bundle and return errors', () => {
      const result = validateBundle(invalidBundle);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject null input', () => {
      const result = validateBundle(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject undefined input', () => {
      const result = validateBundle(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject non-object input', () => {
      const result = validateBundle('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject empty object', () => {
      const result = validateBundle({});
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('error formatting', () => {
    it('should include path in error messages', () => {
      const result = validateBundle({ version: 123 }); // wrong type
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.path !== undefined)).toBe(true);
    });

    it('should include human-readable messages', () => {
      const result = validateBundle({});
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.every((e) => typeof e.message === 'string')).toBe(true);
    });

    it('should include keyword for each error', () => {
      const result = validateBundle({});
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.every((e) => typeof e.keyword === 'string')).toBe(true);
    });
  });

  describe('version validation', () => {
    it('should validate correct version format', () => {
      const bundle = {
        ...minimalBundle,
        version: 'v1.0',
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid version format', () => {
      const bundle = {
        ...minimalBundle,
        version: '1.0', // missing 'v' prefix
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
      expect(result.errors!.some((e) => e.path.includes('version'))).toBe(true);
    });
  });

  describe('date-time validation', () => {
    it('should validate ISO 8601 date-time', () => {
      const bundle = {
        ...minimalBundle,
        generated_at: '2024-01-15T10:30:00Z',
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid date-time format', () => {
      const bundle = {
        ...minimalBundle,
        generated_at: 'not-a-date',
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });
  });

  describe('nodes validation', () => {
    it('should validate nodes with all required fields', () => {
      const result = validateBundle(validBundle);
      expect(result.valid).toBe(true);
    });

    it('should reject node with invalid kind', () => {
      const bundle = {
        ...minimalBundle,
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'invalid_kind',
            name: 'TestNode',
            language: 'typescript',
            file: 'test.ts',
            span: [0, 100],
          },
        ],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });

    it('should reject node with node_id too short', () => {
      const bundle = {
        ...minimalBundle,
        nodes: [
          {
            node_id: 'short', // less than 8 characters
            kind: 'function',
            name: 'TestNode',
            language: 'typescript',
            file: 'test.ts',
            span: [0, 100],
          },
        ],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });
  });

  describe('edges validation', () => {
    it('should validate edges with required fields', () => {
      const result = validateBundle(validBundle);
      expect(result.valid).toBe(true);
    });

    it('should reject edge with confidence out of range', () => {
      const bundle = {
        ...minimalBundle,
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'src',
            language: 'typescript',
            file: 'test.ts',
            span: [0, 100],
          },
          {
            node_id: 'node87654321',
            kind: 'function',
            name: 'dst',
            language: 'typescript',
            file: 'test.ts',
            span: [100, 200],
          },
        ],
        edges: [
          {
            edge_id: 'edge12345678',
            kind: 'calls',
            src: 'node12345678',
            dst: 'node87654321',
            confidence: 1.5, // out of range
            evidence: ['static_analysis'],
          },
        ],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });

    it('should reject edge with empty evidence array', () => {
      const bundle = {
        ...minimalBundle,
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'src',
            language: 'typescript',
            file: 'test.ts',
            span: [0, 100],
          },
          {
            node_id: 'node87654321',
            kind: 'function',
            name: 'dst',
            language: 'typescript',
            file: 'test.ts',
            span: [100, 200],
          },
        ],
        edges: [
          {
            edge_id: 'edge12345678',
            kind: 'calls',
            src: 'node12345678',
            dst: 'node87654321',
            confidence: 0.9,
            evidence: [], // must have at least 1
          },
        ],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });
  });
});

describe('isValidBundle', () => {
  it('should return true for valid bundle', () => {
    expect(isValidBundle(validBundle)).toBe(true);
  });

  it('should return false for invalid bundle', () => {
    expect(isValidBundle(invalidBundle)).toBe(false);
  });

  it('should act as type guard', () => {
    const data: unknown = validBundle;
    if (isValidBundle(data)) {
      // TypeScript should know this is SemanticGraphBundle
      expect(data.version).toBeDefined();
      expect(data.nodes).toBeDefined();
    }
  });
});

describe('getValidator', () => {
  it('should return the compiled AJV validator function', () => {
    const validator = getValidator();
    expect(validator).toBeDefined();
    expect(typeof validator).toBe('function');
  });

  it('should return a working validator', () => {
    const validator = getValidator();
    const result = validator(validBundle);
    expect(result).toBe(true);
  });

  it('should reject invalid data', () => {
    const validator = getValidator();
    const result = validator({});
    expect(result).toBe(false);
    expect(validator.errors).toBeDefined();
  });
});

describe('formatErrors', () => {
  it('should format AJV errors correctly', () => {
    const validator = getValidator();
    validator({});
    const formatted = formatErrors(validator.errors ?? []);
    expect(formatted.length).toBeGreaterThan(0);
    formatted.forEach((err) => {
      expect(err.path).toBeDefined();
      expect(err.message).toBeDefined();
      expect(err.keyword).toBeDefined();
    });
  });

  it('should handle empty error array', () => {
    const formatted = formatErrors([]);
    expect(formatted).toEqual([]);
  });
});
