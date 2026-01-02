import { describe, it, expect } from 'vitest';
import { validateBundle } from '../../../src/schema/validator';
import { NODE_KINDS, EDGE_KINDS, EVIDENCE_TYPES } from '../../../src/constants';

// Import edge case fixtures
import boundaryValues from '../../../fixtures/edge-cases/boundary-values.json';
import allNodeKinds from '../../../fixtures/edge-cases/all-node-kinds.json';
import allEdgeKinds from '../../../fixtures/edge-cases/all-edge-kinds.json';

describe('edge cases', () => {
  describe('boundary values', () => {
    it('should accept minimum valid version format', () => {
      const result = validateBundle(boundaryValues);
      expect(result.valid).toBe(true);
    });

    it('should accept node_id exactly 8 characters', () => {
      const result = validateBundle(boundaryValues);
      expect(result.valid).toBe(true);
    });

    it('should accept confidence of 0', () => {
      const result = validateBundle(boundaryValues);
      expect(result.valid).toBe(true);
    });

    it('should accept confidence of 1', () => {
      const result = validateBundle(boundaryValues);
      expect(result.valid).toBe(true);
    });

    it('should accept empty string for optional fields', () => {
      const result = validateBundle(boundaryValues);
      expect(result.valid).toBe(true);
    });

    it('should accept empty tags array in annotation', () => {
      const result = validateBundle(boundaryValues);
      expect(result.valid).toBe(true);
    });
  });

  describe('all node kinds', () => {
    it('should validate bundle with all node kinds', () => {
      const result = validateBundle(allNodeKinds);
      expect(result.valid).toBe(true);
    });

    it('should contain a node for each defined kind', () => {
      const nodeKinds = allNodeKinds.nodes.map((n) => n.kind);
      for (const kind of NODE_KINDS) {
        expect(nodeKinds).toContain(kind);
      }
    });
  });

  describe('all edge kinds', () => {
    it('should validate bundle with all edge kinds', () => {
      const result = validateBundle(allEdgeKinds);
      expect(result.valid).toBe(true);
    });

    it('should contain an edge for each defined kind', () => {
      const edgeKinds = allEdgeKinds.edges.map((e) => e.kind);
      for (const kind of EDGE_KINDS) {
        expect(edgeKinds).toContain(kind);
      }
    });
  });

  describe('invalid boundary cases', () => {
    it('should reject node_id less than 8 characters', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'short',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [0, 1],
          },
        ],
        edges: [],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.path.includes('node_id'))).toBe(true);
    });

    it('should reject confidence less than 0', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [0, 1],
          },
        ],
        edges: [
          {
            edge_id: 'edge12345678',
            kind: 'calls',
            src: 'node12345678',
            dst: 'node12345678',
            confidence: -0.1,
            evidence: ['static_analysis'],
          },
        ],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });

    it('should reject confidence greater than 1', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [0, 1],
          },
        ],
        edges: [
          {
            edge_id: 'edge12345678',
            kind: 'calls',
            src: 'node12345678',
            dst: 'node12345678',
            confidence: 1.01,
            evidence: ['static_analysis'],
          },
        ],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });

    it('should reject span with negative values', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [-1, 100],
          },
        ],
        edges: [],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });

    it('should reject span with more than 2 elements', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [0, 100, 200],
          },
        ],
        edges: [],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });

    it('should reject span with only 1 element', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [0],
          },
        ],
        edges: [],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });
  });

  describe('all evidence types', () => {
    it('should accept all valid evidence types', () => {
      for (const evidenceType of EVIDENCE_TYPES) {
        const bundle = {
          version: 'v1.0',
          generated_at: '2024-01-15T00:00:00Z',
          nodes: [
            {
              node_id: 'node12345678',
              kind: 'function',
              name: 'test',
              language: 'ts',
              file: 'test.ts',
              span: [0, 1],
            },
          ],
          edges: [
            {
              edge_id: 'edge12345678',
              kind: 'calls',
              src: 'node12345678',
              dst: 'node12345678',
              confidence: 0.9,
              evidence: [evidenceType],
            },
          ],
          annotations: [],
          patterns: [],
        };
        const result = validateBundle(bundle);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid evidence type', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [0, 1],
          },
        ],
        edges: [
          {
            edge_id: 'edge12345678',
            kind: 'calls',
            src: 'node12345678',
            dst: 'node12345678',
            confidence: 0.9,
            evidence: ['invalid_evidence'],
          },
        ],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });
  });

  describe('additional properties', () => {
    it('should reject additional properties at root level', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [],
        edges: [],
        annotations: [],
        patterns: [],
        extraField: 'should not be allowed',
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });

    it('should reject additional properties in node', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [0, 1],
            extraField: 'not allowed',
          },
        ],
        edges: [],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(false);
    });

    it('should allow additional properties in edge meta', () => {
      const bundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'ts',
            file: 'test.ts',
            span: [0, 1],
          },
        ],
        edges: [
          {
            edge_id: 'edge12345678',
            kind: 'calls',
            src: 'node12345678',
            dst: 'node12345678',
            confidence: 0.9,
            evidence: ['static_analysis'],
            meta: {
              customField: 'allowed',
              anotherField: 123,
            },
          },
        ],
        annotations: [],
        patterns: [],
      };
      const result = validateBundle(bundle);
      expect(result.valid).toBe(true);
    });
  });
});
