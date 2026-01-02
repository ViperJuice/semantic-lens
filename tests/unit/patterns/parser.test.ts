/**
 * Tests for YAML DSL Parser.
 */

import { describe, it, expect } from 'vitest';
import { DSLParser, createDSLParser } from '../../../src/patterns/dsl/parser.js';

describe('DSLParser', () => {
  describe('parse', () => {
    it('should parse a minimal pattern', () => {
      const yaml = `
id: minimal
roles:
  target:
    kind: class
constraints: []
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      const patterns = parser.parse(yaml);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].id).toBe('minimal');
      expect(patterns[0].roles.target.kind).toBe('class');
      expect(patterns[0].constraints).toEqual([]);
      expect(patterns[0].scoring.base).toBe(1.0);
    });

    it('should parse the Observer pattern from spec', () => {
      const yaml = `
id: observer
name: Observer Pattern
description: Subject notifies multiple observers
roles:
  subject:
    kind: class
  notify:
    kind: method
    owned_by: subject
  observer:
    kind: class
  update:
    kind: method
    owned_by: observer
constraints:
  - type: edge
    kind: calls
    from: notify
    to: update
  - type: group
    role: observer
    min_size: 2
  - type: optional
    constraint:
      type: edge
      kind: implements
      from: observer
      to: observer_base
    bind_as: observer_base
scoring:
  base: 0.4
  weights:
    calls_notify_update: 0.3
    multiple_observers: 0.2
    has_observer_base: 0.1
`;
      const parser = new DSLParser();
      const patterns = parser.parse(yaml);

      expect(patterns).toHaveLength(1);
      const p = patterns[0];
      expect(p.id).toBe('observer');
      expect(p.name).toBe('Observer Pattern');
      expect(p.description).toBe('Subject notifies multiple observers');

      // Check roles
      expect(Object.keys(p.roles)).toHaveLength(4);
      expect(p.roles.subject.kind).toBe('class');
      expect(p.roles.notify.kind).toBe('method');
      expect(p.roles.notify.owned_by).toBe('subject');

      // Check constraints
      expect(p.constraints).toHaveLength(3);
      expect(p.constraints[0].type).toBe('edge');
      expect(p.constraints[1].type).toBe('group');
      expect(p.constraints[2].type).toBe('optional');

      // Check scoring
      expect(p.scoring.base).toBe(0.4);
      expect(p.scoring.weights.calls_notify_update).toBe(0.3);
    });

    it('should parse multiple patterns in a file', () => {
      const yaml = `
patterns:
  - id: pattern1
    roles:
      a:
        kind: class
    constraints: []
    scoring:
      base: 1.0
      weights: {}
  - id: pattern2
    roles:
      b:
        kind: function
    constraints: []
    scoring:
      base: 0.5
      weights: {}
`;
      const parser = createDSLParser();
      const patterns = parser.parse(yaml);

      expect(patterns).toHaveLength(2);
      expect(patterns[0].id).toBe('pattern1');
      expect(patterns[1].id).toBe('pattern2');
    });

    it('should parse edge constraint with array target', () => {
      const yaml = `
id: multi-target
roles:
  source:
    kind: method
  target1:
    kind: method
  target2:
    kind: method
constraints:
  - type: edge
    kind: calls
    from: source
    to:
      - target1
      - target2
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      const patterns = parser.parse(yaml);

      expect(patterns[0].constraints[0].type).toBe('edge');
      const edge = patterns[0].constraints[0];
      if (edge.type === 'edge') {
        expect(edge.to).toEqual(['target1', 'target2']);
      }
    });

    it('should parse role with regex name pattern', () => {
      const yaml = `
id: regex-name
roles:
  accessor:
    kind: method
    name: /get.*Instance/i
constraints: []
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      const patterns = parser.parse(yaml);

      expect(patterns[0].roles.accessor.name).toBeInstanceOf(RegExp);
      expect((patterns[0].roles.accessor.name as RegExp).test('getInstance')).toBe(true);
      expect((patterns[0].roles.accessor.name as RegExp).test('GetInstance')).toBe(true);
    });

    it('should parse edge constraint with minConfidence', () => {
      const yaml = `
id: confident
roles:
  a:
    kind: class
  b:
    kind: class
constraints:
  - type: edge
    kind: calls
    from: a
    to: b
    minConfidence: 0.8
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      const patterns = parser.parse(yaml);

      const edge = patterns[0].constraints[0];
      if (edge.type === 'edge') {
        expect(edge.minConfidence).toBe(0.8);
      }
    });

    it('should parse group constraint with max_size', () => {
      const yaml = `
id: bounded-group
roles:
  item:
    kind: class
constraints:
  - type: group
    role: item
    min_size: 2
    max_size: 10
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      const patterns = parser.parse(yaml);

      const group = patterns[0].constraints[0];
      if (group.type === 'group') {
        expect(group.min_size).toBe(2);
        expect(group.max_size).toBe(10);
      }
    });

    // Error cases
    it('should throw on missing id', () => {
      const yaml = `
roles:
  a:
    kind: class
constraints: []
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      expect(() => parser.parse(yaml)).toThrow('missing required field "id"');
    });

    it('should throw on missing roles', () => {
      const yaml = `
patterns:
  - id: no-roles
    constraints: []
    scoring:
      base: 1.0
      weights: {}
`;
      const parser = createDSLParser();
      expect(() => parser.parse(yaml)).toThrow('missing required field "roles"');
    });

    it('should throw on invalid node kind', () => {
      const yaml = `
id: bad-kind
roles:
  target:
    kind: invalid_kind
constraints: []
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      expect(() => parser.parse(yaml)).toThrow('invalid kind "invalid_kind"');
    });

    it('should throw on invalid edge kind', () => {
      const yaml = `
id: bad-edge
roles:
  a:
    kind: class
  b:
    kind: class
constraints:
  - type: edge
    kind: invalid_edge
    from: a
    to: b
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      expect(() => parser.parse(yaml)).toThrow('invalid kind "invalid_edge"');
    });

    it('should throw on scoring base out of range', () => {
      const yaml = `
id: bad-score
roles:
  a:
    kind: class
constraints: []
scoring:
  base: 1.5
  weights: {}
`;
      const parser = createDSLParser();
      expect(() => parser.parse(yaml)).toThrow('base must be between 0 and 1');
    });

    it('should throw on group constraint with min_size < 1', () => {
      const yaml = `
id: bad-group
roles:
  item:
    kind: class
constraints:
  - type: group
    role: item
    min_size: 0
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      expect(() => parser.parse(yaml)).toThrow('must have min_size >= 1');
    });

    it('should throw on unknown constraint type', () => {
      const yaml = `
id: unknown-constraint
roles:
  a:
    kind: class
constraints:
  - type: unknown_type
scoring:
  base: 1.0
  weights: {}
`;
      const parser = createDSLParser();
      expect(() => parser.parse(yaml)).toThrow('unknown type "unknown_type"');
    });

    it('should throw on invalid YAML', () => {
      const parser = createDSLParser();
      expect(() => parser.parse('not: valid: yaml: ::')).toThrow();
    });

    it('should throw on empty YAML', () => {
      const parser = createDSLParser();
      expect(() => parser.parse('')).toThrow();
    });
  });

  describe('validate', () => {
    it('should return valid for correct pattern', () => {
      const pattern = {
        id: 'test',
        roles: { a: { kind: 'class' } },
        constraints: [],
        scoring: { base: 0.5, weights: {} },
      };
      const parser = createDSLParser();
      const result = parser.validate(pattern);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing id', () => {
      const pattern = {
        roles: { a: { kind: 'class' } },
        constraints: [],
        scoring: { base: 0.5, weights: {} },
      };
      const parser = createDSLParser();
      const result = parser.validate(pattern);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    it('should return errors for missing roles', () => {
      const pattern = {
        id: 'test',
        constraints: [],
        scoring: { base: 0.5, weights: {} },
      };
      const parser = createDSLParser();
      const result = parser.validate(pattern);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('roles'))).toBe(true);
    });

    it('should return errors for invalid scoring', () => {
      const pattern = {
        id: 'test',
        roles: { a: { kind: 'class' } },
        constraints: [],
        scoring: { base: 2.0, weights: {} },
      };
      const parser = createDSLParser();
      const result = parser.validate(pattern);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('between 0 and 1'))).toBe(true);
    });
  });
});
