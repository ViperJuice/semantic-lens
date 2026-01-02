import { describe, it, expect } from 'vitest';
import {
  NODE_KINDS,
  EDGE_KINDS,
  VISIBILITY,
  EVIDENCE_TYPES,
  type NodeKind,
  type EdgeKind,
  type Visibility,
  type Evidence,
} from '../../src/constants';

describe('constants', () => {
  describe('NODE_KINDS', () => {
    it('should contain all required node kinds', () => {
      const expectedKinds = [
        'module',
        'class',
        'interface',
        'trait',
        'function',
        'method',
        'field',
        'property',
      ];
      expect(NODE_KINDS).toEqual(expectedKinds);
    });

    it('should be a readonly tuple', () => {
      expect(Object.isFrozen(NODE_KINDS)).toBe(true);
    });

    it('should have NodeKind type matching array elements', () => {
      const kind: NodeKind = 'class';
      expect(NODE_KINDS).toContain(kind);
    });
  });

  describe('EDGE_KINDS', () => {
    it('should contain all required edge kinds', () => {
      const expectedKinds = [
        'defines',
        'imports',
        'calls',
        'inherits',
        'implements',
        'uses',
        'reads',
        'writes',
        'throws',
      ];
      expect(EDGE_KINDS).toEqual(expectedKinds);
    });

    it('should be a readonly tuple', () => {
      expect(Object.isFrozen(EDGE_KINDS)).toBe(true);
    });

    it('should have EdgeKind type matching array elements', () => {
      const kind: EdgeKind = 'calls';
      expect(EDGE_KINDS).toContain(kind);
    });
  });

  describe('VISIBILITY', () => {
    it('should contain all visibility levels', () => {
      const expectedLevels = ['public', 'protected', 'private', 'unknown'];
      expect(VISIBILITY).toEqual(expectedLevels);
    });

    it('should be a readonly tuple', () => {
      expect(Object.isFrozen(VISIBILITY)).toBe(true);
    });

    it('should have Visibility type matching array elements', () => {
      const vis: Visibility = 'public';
      expect(VISIBILITY).toContain(vis);
    });
  });

  describe('EVIDENCE_TYPES', () => {
    it('should contain all evidence types', () => {
      const expectedTypes = ['chunker', 'lsp', 'static_analysis', 'heuristic', 'llm_score'];
      expect(EVIDENCE_TYPES).toEqual(expectedTypes);
    });

    it('should be a readonly tuple', () => {
      expect(Object.isFrozen(EVIDENCE_TYPES)).toBe(true);
    });

    it('should have Evidence type matching array elements', () => {
      const evidence: Evidence = 'lsp';
      expect(EVIDENCE_TYPES).toContain(evidence);
    });
  });
});
