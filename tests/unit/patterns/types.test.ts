/**
 * Tests for pattern types and type guards.
 */

import { describe, it, expect } from 'vitest';
import {
  isEdgeConstraint,
  isGroupConstraint,
  isOptionalConstraint,
  isValidRoleSpec,
  isValidScoringConfig,
  isValidPatternDefinition,
  isValidConstraint,
  type PatternDefinition,
  type EdgeConstraint,
  type GroupConstraint,
  type OptionalConstraint,
  type RoleSpec,
  type ScoringConfig,
} from '../../../src/patterns/types.js';

describe('Pattern Types', () => {
  describe('Type Guards', () => {
    describe('isEdgeConstraint', () => {
      it('should return true for edge constraints', () => {
        const constraint: EdgeConstraint = {
          type: 'edge',
          kind: 'calls',
          from: 'notify',
          to: 'update',
        };
        expect(isEdgeConstraint(constraint)).toBe(true);
      });

      it('should return false for non-edge constraints', () => {
        const constraint: GroupConstraint = {
          type: 'group',
          role: 'observer',
          min_size: 2,
        };
        expect(isEdgeConstraint(constraint)).toBe(false);
      });
    });

    describe('isGroupConstraint', () => {
      it('should return true for group constraints', () => {
        const constraint: GroupConstraint = {
          type: 'group',
          role: 'observer',
          min_size: 2,
        };
        expect(isGroupConstraint(constraint)).toBe(true);
      });

      it('should return false for non-group constraints', () => {
        const constraint: EdgeConstraint = {
          type: 'edge',
          kind: 'calls',
          from: 'notify',
          to: 'update',
        };
        expect(isGroupConstraint(constraint)).toBe(false);
      });
    });

    describe('isOptionalConstraint', () => {
      it('should return true for optional constraints', () => {
        const constraint: OptionalConstraint = {
          type: 'optional',
          constraint: {
            type: 'edge',
            kind: 'implements',
            from: 'observer',
            to: 'observer_base',
          },
          bind_as: 'observer_base',
        };
        expect(isOptionalConstraint(constraint)).toBe(true);
      });

      it('should return false for non-optional constraints', () => {
        const constraint: EdgeConstraint = {
          type: 'edge',
          kind: 'calls',
          from: 'notify',
          to: 'update',
        };
        expect(isOptionalConstraint(constraint)).toBe(false);
      });
    });
  });

  describe('Validation Functions', () => {
    describe('isValidRoleSpec', () => {
      it('should validate a minimal role spec', () => {
        const role: RoleSpec = { kind: 'class' };
        expect(isValidRoleSpec(role)).toBe(true);
      });

      it('should validate a role spec with owned_by', () => {
        const role: RoleSpec = { kind: 'method', owned_by: 'subject' };
        expect(isValidRoleSpec(role)).toBe(true);
      });

      it('should validate a role spec with name pattern', () => {
        const role: RoleSpec = { kind: 'method', name: /notify/i };
        expect(isValidRoleSpec(role)).toBe(true);
      });

      it('should reject null', () => {
        expect(isValidRoleSpec(null)).toBe(false);
      });

      it('should reject non-objects', () => {
        expect(isValidRoleSpec('string')).toBe(false);
        expect(isValidRoleSpec(123)).toBe(false);
      });

      it('should reject objects without kind', () => {
        expect(isValidRoleSpec({ owned_by: 'parent' })).toBe(false);
      });
    });

    describe('isValidScoringConfig', () => {
      it('should validate a valid scoring config', () => {
        const config: ScoringConfig = {
          base: 0.4,
          weights: {
            calls_notify_update: 0.3,
            multiple_observers: 0.2,
            has_observer_base: 0.1,
          },
        };
        expect(isValidScoringConfig(config)).toBe(true);
      });

      it('should validate config with base 0', () => {
        const config: ScoringConfig = { base: 0, weights: {} };
        expect(isValidScoringConfig(config)).toBe(true);
      });

      it('should validate config with base 1', () => {
        const config: ScoringConfig = { base: 1, weights: {} };
        expect(isValidScoringConfig(config)).toBe(true);
      });

      it('should reject null', () => {
        expect(isValidScoringConfig(null)).toBe(false);
      });

      it('should reject base < 0', () => {
        expect(isValidScoringConfig({ base: -0.1, weights: {} })).toBe(false);
      });

      it('should reject base > 1', () => {
        expect(isValidScoringConfig({ base: 1.1, weights: {} })).toBe(false);
      });

      it('should reject negative weights', () => {
        expect(
          isValidScoringConfig({ base: 0.5, weights: { foo: -0.1 } })
        ).toBe(false);
      });

      it('should reject weights > 1', () => {
        expect(isValidScoringConfig({ base: 0.5, weights: { foo: 1.5 } })).toBe(
          false
        );
      });
    });

    describe('isValidConstraint', () => {
      it('should validate edge constraint', () => {
        const constraint: EdgeConstraint = {
          type: 'edge',
          kind: 'calls',
          from: 'notify',
          to: 'update',
        };
        expect(isValidConstraint(constraint)).toBe(true);
      });

      it('should validate edge constraint with array target', () => {
        const constraint: EdgeConstraint = {
          type: 'edge',
          kind: 'calls',
          from: 'notify',
          to: ['update1', 'update2'],
        };
        expect(isValidConstraint(constraint)).toBe(true);
      });

      it('should validate group constraint', () => {
        const constraint: GroupConstraint = {
          type: 'group',
          role: 'observer',
          min_size: 2,
        };
        expect(isValidConstraint(constraint)).toBe(true);
      });

      it('should validate group constraint with max_size', () => {
        const constraint: GroupConstraint = {
          type: 'group',
          role: 'observer',
          min_size: 2,
          max_size: 10,
        };
        expect(isValidConstraint(constraint)).toBe(true);
      });

      it('should validate optional constraint', () => {
        const constraint: OptionalConstraint = {
          type: 'optional',
          constraint: {
            type: 'edge',
            kind: 'implements',
            from: 'observer',
            to: 'base',
          },
        };
        expect(isValidConstraint(constraint)).toBe(true);
      });

      it('should reject null', () => {
        expect(isValidConstraint(null)).toBe(false);
      });

      it('should reject unknown type', () => {
        expect(isValidConstraint({ type: 'unknown' })).toBe(false);
      });

      it('should reject edge constraint without kind', () => {
        expect(
          isValidConstraint({ type: 'edge', from: 'a', to: 'b' })
        ).toBe(false);
      });

      it('should reject group constraint with min_size < 1', () => {
        expect(
          isValidConstraint({ type: 'group', role: 'r', min_size: 0 })
        ).toBe(false);
      });
    });

    describe('isValidPatternDefinition', () => {
      it('should validate a complete pattern definition', () => {
        const pattern: PatternDefinition = {
          id: 'observer',
          name: 'Observer Pattern',
          description: 'Subject notifies observers',
          roles: {
            subject: { kind: 'class' },
            notify: { kind: 'method', owned_by: 'subject' },
            observer: { kind: 'class' },
            update: { kind: 'method', owned_by: 'observer' },
          },
          constraints: [
            { type: 'edge', kind: 'calls', from: 'notify', to: 'update' },
            { type: 'group', role: 'observer', min_size: 2 },
          ],
          scoring: {
            base: 0.4,
            weights: {
              calls_notify_update: 0.3,
              multiple_observers: 0.2,
            },
          },
        };
        expect(isValidPatternDefinition(pattern)).toBe(true);
      });

      it('should validate minimal pattern definition', () => {
        const pattern: PatternDefinition = {
          id: 'minimal',
          roles: { target: { kind: 'class' } },
          constraints: [],
          scoring: { base: 1.0, weights: {} },
        };
        expect(isValidPatternDefinition(pattern)).toBe(true);
      });

      it('should reject null', () => {
        expect(isValidPatternDefinition(null)).toBe(false);
      });

      it('should reject pattern without id', () => {
        expect(
          isValidPatternDefinition({
            roles: {},
            constraints: [],
            scoring: { base: 1, weights: {} },
          })
        ).toBe(false);
      });

      it('should reject pattern with empty id', () => {
        expect(
          isValidPatternDefinition({
            id: '',
            roles: {},
            constraints: [],
            scoring: { base: 1, weights: {} },
          })
        ).toBe(false);
      });

      it('should reject pattern without roles', () => {
        expect(
          isValidPatternDefinition({
            id: 'test',
            constraints: [],
            scoring: { base: 1, weights: {} },
          })
        ).toBe(false);
      });

      it('should reject pattern with invalid scoring', () => {
        expect(
          isValidPatternDefinition({
            id: 'test',
            roles: {},
            constraints: [],
            scoring: { base: 2, weights: {} },
          })
        ).toBe(false);
      });
    });
  });
});
