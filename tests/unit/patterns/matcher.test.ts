/**
 * Tests for Pattern Matcher.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PatternMatcher, createPatternMatcher } from '../../../src/patterns/matcher/matcher.js';
import { createInMemoryStore } from '../../../src/graph/memory-store.js';
import type { GraphStore } from '../../../src/graph/store.js';
import type { PatternDefinition, PatternMatch } from '../../../src/patterns/types.js';
import type { SemanticGraphBundle } from '../../../src/schema/types.js';

describe('PatternMatcher', () => {
  let store: GraphStore;

  // Test graph with Observer pattern
  const observerGraph: SemanticGraphBundle = {
    version: 'v1.0',
    generated_at: new Date().toISOString(),
    nodes: [
      { node_id: 'subject-1', kind: 'class', name: 'EventEmitter', language: 'typescript', file: 'src/events.ts', span: [1, 100] },
      { node_id: 'notify-1', kind: 'method', name: 'emit', language: 'typescript', file: 'src/events.ts', span: [10, 20], parent: 'subject-1' },
      { node_id: 'observer-1', kind: 'class', name: 'LogHandler', language: 'typescript', file: 'src/handlers.ts', span: [1, 50] },
      { node_id: 'observer-2', kind: 'class', name: 'MetricsHandler', language: 'typescript', file: 'src/handlers.ts', span: [51, 100] },
      { node_id: 'update-1', kind: 'method', name: 'onEvent', language: 'typescript', file: 'src/handlers.ts', span: [10, 20], parent: 'observer-1' },
      { node_id: 'update-2', kind: 'method', name: 'onEvent', language: 'typescript', file: 'src/handlers.ts', span: [60, 70], parent: 'observer-2' },
    ],
    edges: [
      { edge_id: 'e1', kind: 'defines', src: 'subject-1', dst: 'notify-1', confidence: 1.0, evidence: ['chunker'] },
      { edge_id: 'e2', kind: 'defines', src: 'observer-1', dst: 'update-1', confidence: 1.0, evidence: ['chunker'] },
      { edge_id: 'e3', kind: 'defines', src: 'observer-2', dst: 'update-2', confidence: 1.0, evidence: ['chunker'] },
      { edge_id: 'e4', kind: 'calls', src: 'notify-1', dst: 'update-1', confidence: 0.9, evidence: ['static_analysis'] },
      { edge_id: 'e5', kind: 'calls', src: 'notify-1', dst: 'update-2', confidence: 0.9, evidence: ['static_analysis'] },
    ],
    annotations: [],
    patterns: [],
  };

  // Singleton pattern graph
  const singletonGraph: SemanticGraphBundle = {
    version: 'v1.0',
    generated_at: new Date().toISOString(),
    nodes: [
      { node_id: 'singleton-1', kind: 'class', name: 'Database', language: 'typescript', file: 'src/db.ts', span: [1, 100] },
      { node_id: 'accessor-1', kind: 'method', name: 'getInstance', language: 'typescript', file: 'src/db.ts', span: [10, 20], parent: 'singleton-1' },
      { node_id: 'field-1', kind: 'field', name: '_instance', language: 'typescript', file: 'src/db.ts', span: [5, 6], parent: 'singleton-1' },
    ],
    edges: [
      { edge_id: 'e1', kind: 'defines', src: 'singleton-1', dst: 'accessor-1', confidence: 1.0, evidence: ['chunker'] },
      { edge_id: 'e2', kind: 'defines', src: 'singleton-1', dst: 'field-1', confidence: 1.0, evidence: ['chunker'] },
      { edge_id: 'e3', kind: 'reads', src: 'accessor-1', dst: 'field-1', confidence: 0.95, evidence: ['static_analysis'] },
    ],
    annotations: [],
    patterns: [],
  };

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
    ],
    scoring: {
      base: 0.4,
      weights: {
        notify_calls_update: 0.3,
        multiple_observers: 0.2,
      },
    },
  };

  const singletonPattern: PatternDefinition = {
    id: 'singleton',
    name: 'Singleton Pattern',
    roles: {
      singleton_class: { kind: 'class' },
      accessor: { kind: 'method', owned_by: 'singleton_class', name: /getInstance/i },
      instance_field: { kind: 'field', owned_by: 'singleton_class', name: /instance/i },
    },
    constraints: [
      { type: 'edge', kind: 'reads', from: 'accessor', to: 'instance_field' },
    ],
    scoring: {
      base: 0.5,
      weights: {
        accessor_reads_instance_field: 0.5,
      },
    },
  };

  beforeEach(async () => {
    store = createInMemoryStore();
  });

  describe('loadDefinitions', () => {
    it('should load pattern definitions', () => {
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([observerPattern, singletonPattern]);

      const defs = matcher.getDefinitions();
      expect(defs).toHaveLength(2);
      expect(defs.map((d) => d.id)).toContain('observer');
      expect(defs.map((d) => d.id)).toContain('singleton');
    });

    it('should replace patterns with same id', () => {
      const matcher = new PatternMatcher();
      matcher.loadDefinitions([observerPattern]);
      matcher.loadDefinitions([{ ...observerPattern, name: 'Updated Observer' }]);

      const defs = matcher.getDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe('Updated Observer');
    });
  });

  describe('matchPattern', () => {
    it('should throw for unknown pattern', async () => {
      const matcher = createPatternMatcher();
      await expect(matcher.matchPattern(store, 'unknown')).rejects.toThrow('Pattern not found');
    });

    it('should detect Observer pattern in test graph', async () => {
      await store.loadBundle(observerGraph);
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([observerPattern]);

      const matches = await matcher.matchPattern(store, 'observer');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].patternId).toBe('observer');
      expect(matches[0].confidence).toBeGreaterThan(0.4);
    });

    it('should detect Singleton pattern in test graph', async () => {
      await store.loadBundle(singletonGraph);
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([singletonPattern]);

      const matches = await matcher.matchPattern(store, 'singleton');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].patternId).toBe('singleton');
      expect(matches[0].roles.singleton_class).toBe('singleton-1');
      expect(matches[0].roles.accessor).toBe('accessor-1');
      expect(matches[0].roles.instance_field).toBe('field-1');
    });

    it('should return empty for no matches', async () => {
      // Load singleton graph but look for observer pattern
      await store.loadBundle(singletonGraph);
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([observerPattern]);

      const matches = await matcher.matchPattern(store, 'observer');

      expect(matches).toHaveLength(0);
    });

    it('should include evidence in matches', async () => {
      await store.loadBundle(singletonGraph);
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([singletonPattern]);

      const matches = await matcher.matchPattern(store, 'singleton');

      expect(matches[0].evidence.length).toBeGreaterThan(0);
      expect(matches[0].explain).toBeDefined();
    });

    it('should generate unique instance IDs', async () => {
      await store.loadBundle(observerGraph);
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([observerPattern]);

      const matches = await matcher.matchPattern(store, 'observer');
      const instanceIds = new Set(matches.map((m) => m.instanceId));

      expect(instanceIds.size).toBe(matches.length);
    });

    it('should filter by scope', async () => {
      await store.loadBundle(observerGraph);
      const matcher = createPatternMatcher();

      // Pattern that requires specific nodes
      const scopedPattern: PatternDefinition = {
        id: 'scoped',
        roles: {
          target: { kind: 'class' },
        },
        constraints: [],
        scoring: { base: 1.0, weights: {} },
      };
      matcher.loadDefinitions([scopedPattern]);

      // Only include specific nodes
      const matches = await matcher.matchPattern(store, 'scoped', ['subject-1']);

      expect(matches).toHaveLength(1);
      expect(matches[0].roles.target).toBe('subject-1');
    });
  });

  describe('match', () => {
    it('should match all loaded patterns', async () => {
      await store.loadBundle(observerGraph);
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([observerPattern, singletonPattern]);

      const matches = await matcher.match(store);

      // Should find observer pattern, but not singleton
      const patternIds = matches.map((m) => m.patternId);
      expect(patternIds).toContain('observer');
    });

    it('should return empty array for empty graph', async () => {
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([observerPattern]);

      const matches = await matcher.match(store);

      expect(matches).toHaveLength(0);
    });

    it('should return empty array for no loaded patterns', async () => {
      await store.loadBundle(observerGraph);
      const matcher = createPatternMatcher();

      const matches = await matcher.match(store);

      expect(matches).toHaveLength(0);
    });
  });

  describe('performance', () => {
    it('should match patterns in reasonable time for medium graphs', async () => {
      // Create a graph with many nodes
      const nodes = [];
      const edges = [];

      for (let i = 0; i < 100; i++) {
        nodes.push({
          node_id: `class-${i}`,
          kind: 'class' as const,
          name: `Class${i}`,
          language: 'typescript',
          file: `src/class${i}.ts`,
          span: [1, 100] as [number, number],
        });

        if (i > 0) {
          edges.push({
            edge_id: `edge-${i}`,
            kind: 'uses' as const,
            src: `class-${i}`,
            dst: `class-${i - 1}`,
            confidence: 0.8,
            evidence: ['static_analysis' as const],
          });
        }
      }

      const largeGraph: SemanticGraphBundle = {
        version: 'v1.0',
        generated_at: new Date().toISOString(),
        nodes,
        edges,
        annotations: [],
        patterns: [],
      };

      await store.loadBundle(largeGraph);
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([observerPattern]);

      const start = Date.now();
      await matcher.match(store);
      const duration = Date.now() - start;

      // Should complete in reasonable time (< 500ms)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate identical matches', async () => {
      await store.loadBundle(observerGraph);
      const matcher = createPatternMatcher();
      matcher.loadDefinitions([observerPattern]);

      const matches = await matcher.matchPattern(store, 'observer');

      // Each unique set of nodes should appear only once
      const signatures = matches.map((m) => {
        const nodeIds = Object.values(m.roles)
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .sort()
          .join(',');
        return `${m.patternId}:${nodeIds}`;
      });

      const uniqueSignatures = new Set(signatures);
      expect(uniqueSignatures.size).toBe(matches.length);
    });
  });
});
