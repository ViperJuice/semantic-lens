/**
 * Tests for Cypher Query Compiler.
 */

import { describe, it, expect } from 'vitest';
import { CypherCompiler, createCypherCompiler } from '../../../src/patterns/cypher/compiler.js';
import type { PatternDefinition } from '../../../src/patterns/types.js';

describe('CypherCompiler', () => {
  describe('compile', () => {
    it('should compile a minimal pattern', () => {
      const pattern: PatternDefinition = {
        id: 'minimal',
        roles: {
          target: { kind: 'class' },
        },
        constraints: [],
        scoring: { base: 1.0, weights: {} },
      };

      const compiler = createCypherCompiler();
      const cypher = compiler.compile(pattern);

      expect(cypher).toContain("MATCH (target:Sym {kind: 'class'})");
      expect(cypher).toContain('RETURN');
      expect(cypher).toContain('target.node_id AS target_id');
      expect(cypher).toContain('1 AS confidence');
    });

    it('should compile Observer pattern', () => {
      const pattern: PatternDefinition = {
        id: 'observer',
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
          weights: { calls_notify_update: 0.3, multiple_observers: 0.2 },
        },
      };

      const compiler = new CypherCompiler();
      const cypher = compiler.compile(pattern);

      // Check roles
      expect(cypher).toContain("MATCH (subject:Sym {kind: 'class'})");
      expect(cypher).toContain("MATCH (observer:Sym {kind: 'class'})");
      expect(cypher).toContain('(subject)-[:DEFINES]->(notify:Sym');
      expect(cypher).toContain('(observer)-[:DEFINES]->(update:Sym');

      // Check edge constraint
      expect(cypher).toContain('MATCH (notify)-[');
      expect(cypher).toContain(':CALLS]->(update)');

      // Check group constraint
      expect(cypher).toContain('collect(DISTINCT observer)');
      expect(cypher).toContain('size(observers) >= 2');

      // Check return
      expect(cypher).toContain('RETURN');
    });

    it('should compile Strategy pattern', () => {
      const pattern: PatternDefinition = {
        id: 'strategy',
        roles: {
          context: { kind: 'class' },
          strategy_interface: { kind: 'interface' },
          strategy_impl: { kind: 'class' },
        },
        constraints: [
          { type: 'edge', kind: 'uses', from: 'context', to: 'strategy_interface' },
          { type: 'edge', kind: 'implements', from: 'strategy_impl', to: 'strategy_interface' },
          { type: 'group', role: 'strategy_impl', min_size: 2 },
        ],
        scoring: { base: 0.4, weights: {} },
      };

      const compiler = createCypherCompiler();
      const cypher = compiler.compile(pattern);

      expect(cypher).toContain("MATCH (context:Sym {kind: 'class'})");
      expect(cypher).toContain("MATCH (strategy_interface:Sym {kind: 'interface'})");
      expect(cypher).toContain(':USES]->');
      expect(cypher).toContain(':IMPLEMENTS]->');
      expect(cypher).toContain('size(strategy_impls) >= 2');
    });

    it('should compile Factory pattern', () => {
      const pattern: PatternDefinition = {
        id: 'factory',
        roles: {
          creator: { kind: 'class' },
          factory_method: { kind: 'method', owned_by: 'creator', name: 'create' },
          product_base: { kind: 'interface' },
          product: { kind: 'class' },
        },
        constraints: [
          { type: 'edge', kind: 'calls', from: 'factory_method', to: 'product' },
          { type: 'edge', kind: 'implements', from: 'product', to: 'product_base' },
          { type: 'group', role: 'product', min_size: 2 },
        ],
        scoring: { base: 0.3, weights: {} },
      };

      const compiler = createCypherCompiler();
      const cypher = compiler.compile(pattern);

      expect(cypher).toContain("MATCH (creator:Sym {kind: 'class'})");
      expect(cypher).toContain("(creator)-[:DEFINES]->(factory_method:Sym {kind: 'method'");
      expect(cypher).toContain("name: 'create'");
      expect(cypher).toContain('size(products) >= 2');
    });

    it('should compile Singleton pattern', () => {
      const pattern: PatternDefinition = {
        id: 'singleton',
        roles: {
          singleton_class: { kind: 'class' },
          accessor: { kind: 'method', owned_by: 'singleton_class' },
          instance_field: { kind: 'field', owned_by: 'singleton_class' },
        },
        constraints: [
          { type: 'edge', kind: 'reads', from: 'accessor', to: 'instance_field' },
        ],
        scoring: { base: 0.5, weights: {} },
      };

      const compiler = createCypherCompiler();
      const cypher = compiler.compile(pattern);

      expect(cypher).toContain("MATCH (singleton_class:Sym {kind: 'class'})");
      expect(cypher).toContain('(singleton_class)-[:DEFINES]->(accessor');
      expect(cypher).toContain('(singleton_class)-[:DEFINES]->(instance_field');
      expect(cypher).toContain(':READS]->');
    });

    it('should handle optional constraints', () => {
      const pattern: PatternDefinition = {
        id: 'with-optional',
        roles: {
          observer: { kind: 'class' },
          base: { kind: 'interface' },
        },
        constraints: [
          {
            type: 'optional',
            constraint: {
              type: 'edge',
              kind: 'implements',
              from: 'observer',
              to: 'base',
            },
            bind_as: 'observer_base',
          },
        ],
        scoring: { base: 0.5, weights: {} },
      };

      const compiler = createCypherCompiler();
      const cypher = compiler.compile(pattern);

      expect(cypher).toContain('OPTIONAL MATCH');
      expect(cypher).toContain('(observer)-[:IMPLEMENTS]->(observer_base:Sym)');
    });

    it('should handle edge constraint with minConfidence', () => {
      const pattern: PatternDefinition = {
        id: 'confident',
        roles: {
          a: { kind: 'class' },
          b: { kind: 'class' },
        },
        constraints: [
          { type: 'edge', kind: 'calls', from: 'a', to: 'b', minConfidence: 0.8 },
        ],
        scoring: { base: 1.0, weights: {} },
      };

      const compiler = createCypherCompiler();
      const cypher = compiler.compile(pattern);

      expect(cypher).toContain('r_a_b.confidence >= 0.8');
    });

    it('should handle group constraint with max_size', () => {
      const pattern: PatternDefinition = {
        id: 'bounded',
        roles: {
          item: { kind: 'class' },
        },
        constraints: [
          { type: 'group', role: 'item', min_size: 2, max_size: 5 },
        ],
        scoring: { base: 1.0, weights: {} },
      };

      const compiler = createCypherCompiler();
      const cypher = compiler.compile(pattern);

      expect(cypher).toContain('size(items) >= 2');
      expect(cypher).toContain('size(items) <= 5');
    });

    it('should generate valid Cypher structure', () => {
      const pattern: PatternDefinition = {
        id: 'structure-test',
        roles: {
          root: { kind: 'class' },
        },
        constraints: [],
        scoring: { base: 0.5, weights: {} },
      };

      const compiler = createCypherCompiler();
      const cypher = compiler.compile(pattern);

      // Should have MATCH before RETURN
      const matchIndex = cypher.indexOf('MATCH');
      const returnIndex = cypher.indexOf('RETURN');

      expect(matchIndex).toBeGreaterThanOrEqual(0);
      expect(returnIndex).toBeGreaterThan(matchIndex);
    });
  });

  describe('compileRoles', () => {
    it('should compile standalone roles', () => {
      const compiler = createCypherCompiler();
      const result = compiler.compileRoles({
        a: { kind: 'class' },
        b: { kind: 'function' },
      });

      expect(result).toContain("MATCH (a:Sym {kind: 'class'})");
      expect(result).toContain("MATCH (b:Sym {kind: 'function'})");
    });

    it('should compile owned roles with DEFINES', () => {
      const compiler = createCypherCompiler();
      const result = compiler.compileRoles({
        parent: { kind: 'class' },
        child: { kind: 'method', owned_by: 'parent' },
      });

      expect(result).toContain("MATCH (parent:Sym {kind: 'class'})");
      expect(result).toContain('(parent)-[:DEFINES]->(child:Sym');
    });

    it('should compile roles with name constraints', () => {
      const compiler = createCypherCompiler();
      const result = compiler.compileRoles({
        accessor: { kind: 'method', name: 'getInstance' },
      });

      expect(result).toContain("name: 'getInstance'");
    });
  });

  describe('compileConstraints', () => {
    it('should compile edge constraints', () => {
      const compiler = createCypherCompiler();
      const result = compiler.compileConstraints([
        { type: 'edge', kind: 'calls', from: 'a', to: 'b' },
      ]);

      expect(result).toContain(':CALLS]->');
    });

    it('should compile group constraints', () => {
      const compiler = createCypherCompiler();
      const result = compiler.compileConstraints([
        { type: 'group', role: 'item', min_size: 3 },
      ]);

      expect(result).toContain('Group: item');
      expect(result).toContain('min: 3');
    });

    it('should compile optional constraints', () => {
      const compiler = createCypherCompiler();
      const result = compiler.compileConstraints([
        {
          type: 'optional',
          constraint: { type: 'edge', kind: 'implements', from: 'a', to: 'b' },
        },
      ]);

      expect(result).toContain('OPTIONAL MATCH');
    });
  });
});
