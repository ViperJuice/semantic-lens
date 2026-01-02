/**
 * Tests for Pattern Confidence Scorer.
 */

import { describe, it, expect } from 'vitest';
import { PatternScorer, createPatternScorer } from '../../../src/patterns/scorer.js';
import type {
  PatternDefinition,
  RoleBindings,
  ConstraintResult,
  EdgeConstraint,
  GroupConstraint,
  OptionalConstraint,
} from '../../../src/patterns/types.js';

describe('PatternScorer', () => {
  describe('calculateConfidence', () => {
    const observerPattern: PatternDefinition = {
      id: 'observer',
      name: 'Observer Pattern',
      roles: {
        subject: { kind: 'class' },
        notify: { kind: 'method', owned_by: 'subject' },
        observer: { kind: 'class' },
        update: { kind: 'method', owned_by: 'observer' },
      },
      constraints: [
        { type: 'edge', kind: 'calls', from: 'notify', to: 'update' },
        { type: 'group', role: 'observer', min_size: 2 },
        {
          type: 'optional',
          constraint: { type: 'edge', kind: 'implements', from: 'observer', to: 'base' },
          bind_as: 'observer_base',
        },
      ],
      scoring: {
        base: 0.4,
        weights: {
          calls_notify_update: 0.3,
          multiple_observers: 0.2,
          has_observer_base: 0.1,
        },
      },
    };

    it('should return base score when no constraints satisfied', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = {
        subject: 'node-1',
        notify: 'node-2',
        observer: ['node-3', 'node-4'],
        update: 'node-5',
      };
      const constraintResults: ConstraintResult[] = [];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      expect(result.confidence).toBe(0.4);
      expect(result.evidence).toContain('Base score: 0.40');
    });

    it('should add weight for satisfied required constraints', () => {
      const scorer = new PatternScorer();
      const bindings: RoleBindings = {
        subject: 'node-1',
        observer: ['node-2', 'node-3'],
      };

      const edgeConstraint: EdgeConstraint = {
        type: 'edge',
        kind: 'calls',
        from: 'notify',
        to: 'update',
      };

      const constraintResults: ConstraintResult[] = [
        { constraint: edgeConstraint, satisfied: true, weight: 0.3 },
      ];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      expect(result.confidence).toBe(0.7);
    });

    it('should add weight for satisfied group constraints', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = {
        subject: 'node-1',
        observer: ['node-2', 'node-3', 'node-4'],
      };

      const groupConstraint: GroupConstraint = {
        type: 'group',
        role: 'observer',
        min_size: 2,
      };

      const constraintResults: ConstraintResult[] = [
        { constraint: groupConstraint, satisfied: true, weight: 0.2 },
      ];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      expect(result.confidence).toBeCloseTo(0.6);
    });

    it('should add weight for satisfied optional constraints', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = {
        subject: 'node-1',
        observer: ['node-2', 'node-3'],
        observer_base: 'node-5',
      };

      const optionalConstraint: OptionalConstraint = {
        type: 'optional',
        constraint: { type: 'edge', kind: 'implements', from: 'observer', to: 'base' },
        bind_as: 'observer_base',
      };

      const constraintResults: ConstraintResult[] = [
        { constraint: optionalConstraint, satisfied: true, weight: 0.1 },
      ];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      expect(result.confidence).toBe(0.5);
    });

    it('should calculate full score with all constraints satisfied', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = {
        subject: 'node-1',
        notify: 'node-2',
        observer: ['node-3', 'node-4'],
        update: 'node-5',
        observer_base: 'node-6',
      };

      const constraintResults: ConstraintResult[] = [
        {
          constraint: { type: 'edge', kind: 'calls', from: 'notify', to: 'update' },
          satisfied: true,
          weight: 0.3,
        },
        {
          constraint: { type: 'group', role: 'observer', min_size: 2 },
          satisfied: true,
          weight: 0.2,
        },
        {
          constraint: {
            type: 'optional',
            constraint: { type: 'edge', kind: 'implements', from: 'observer', to: 'base' },
          },
          satisfied: true,
          weight: 0.1,
        },
      ];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      expect(result.confidence).toBeCloseTo(1.0);
    });

    it('should clamp score to maximum of 1.0', () => {
      const pattern: PatternDefinition = {
        id: 'over-weighted',
        roles: { a: { kind: 'class' } },
        constraints: [],
        scoring: {
          base: 0.8,
          weights: { extra: 0.5 },
        },
      };

      const scorer = createPatternScorer();
      const constraintResults: ConstraintResult[] = [
        {
          constraint: { type: 'edge', kind: 'calls', from: 'a', to: 'b' },
          satisfied: true,
          weight: 0.5,
        },
      ];

      const result = scorer.calculateConfidence(pattern, { a: 'node-1' }, constraintResults);

      expect(result.confidence).toBe(1.0);
    });

    it('should clamp score to minimum of 0.0', () => {
      const pattern: PatternDefinition = {
        id: 'negative',
        roles: { a: { kind: 'class' } },
        constraints: [],
        scoring: { base: 0.0, weights: {} },
      };

      const scorer = createPatternScorer();
      const result = scorer.calculateConfidence(pattern, { a: 'node-1' }, []);

      expect(result.confidence).toBe(0.0);
    });

    it('should not add weight for unsatisfied required constraints', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = { subject: 'node-1' };

      const constraintResults: ConstraintResult[] = [
        {
          constraint: { type: 'edge', kind: 'calls', from: 'notify', to: 'update' },
          satisfied: false,
          weight: 0.3,
        },
      ];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      expect(result.confidence).toBe(0.4);
      expect(result.evidence.some((e) => e.includes('failed'))).toBe(true);
    });

    it('should not penalize unsatisfied optional constraints', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = { subject: 'node-1' };

      const optionalConstraint: OptionalConstraint = {
        type: 'optional',
        constraint: { type: 'edge', kind: 'implements', from: 'observer', to: 'base' },
      };

      const constraintResults: ConstraintResult[] = [
        { constraint: optionalConstraint, satisfied: false, weight: 0.1 },
      ];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      // Should still be base score, not penalized
      expect(result.confidence).toBe(0.4);
      // Should not mention failed optional
      expect(result.evidence.some((e) => e.includes('failed'))).toBe(false);
    });

    it('should generate evidence strings', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = { subject: 'node-1' };

      const constraintResults: ConstraintResult[] = [
        {
          constraint: { type: 'edge', kind: 'calls', from: 'notify', to: 'update' },
          satisfied: true,
          weight: 0.3,
          evidence: 'Found 3 calls from notify to update methods',
        },
      ];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      expect(result.evidence).toContain('Found 3 calls from notify to update methods');
    });

    it('should generate explanation', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = {
        subject: 'node-1',
        observer: ['node-2', 'node-3'],
      };

      const constraintResults: ConstraintResult[] = [
        {
          constraint: { type: 'group', role: 'observer', min_size: 2 },
          satisfied: true,
          weight: 0.2,
        },
      ];

      const result = scorer.calculateConfidence(observerPattern, bindings, constraintResults);

      expect(result.explain).toContain('Observer Pattern');
      expect(result.explain).toContain('Role Bindings:');
      expect(result.explain).toContain('Constraints:');
      expect(result.explain).toContain('Score Breakdown:');
      expect(result.explain).toContain('Total: 0.60');
    });

    it('should show array role bindings in explanation', () => {
      const scorer = createPatternScorer();
      const bindings: RoleBindings = {
        observer: ['node-1', 'node-2', 'node-3'],
      };

      const result = scorer.calculateConfidence(observerPattern, bindings, []);

      expect(result.explain).toContain('[3 nodes]');
    });
  });
});
