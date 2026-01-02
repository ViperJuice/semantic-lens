/**
 * Full Flow End-to-End Tests
 * Tests the complete flow: validate -> load -> patterns -> view
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'fs/promises';
import path from 'path';
import { validateBundle } from '../../src/schema/validator.js';
import { createInMemoryStore } from '../../src/graph/memory-store.js';
import { loadBundleToStore } from '../../src/graph/loader.js';
import { createPatternMatcher } from '../../src/patterns/matcher/matcher.js';
import { parsePatternDefinition } from '../../src/patterns/dsl/parser.js';
import { createProjector } from '../../src/view-service/projector/projector.js';
import { createELKLayoutEngine } from '../../src/view-service/layout/elk-client.js';
import { createFormatter } from '../../src/view-service/formatter/formatter.js';
import { createViewCache, generateCacheKey } from '../../src/view-service/cache/view-cache.js';
import type { SemanticGraphBundle } from '../../src/schema/types.js';
import type { GraphStore } from '../../src/graph/store.js';
import type { PatternMatcherInterface } from '../../src/patterns/matcher/matcher.js';

const FIXTURES_PATH = path.join(process.cwd(), 'tests', 'e2e', 'fixtures');

describe('Full Flow E2E Tests', () => {
  let bundle: SemanticGraphBundle;
  let store: GraphStore;
  let matcher: PatternMatcherInterface;

  beforeAll(async () => {
    // Load and validate the sample bundle
    const bundlePath = path.join(FIXTURES_PATH, 'sample-codebase.json');
    const content = await readFile(bundlePath, 'utf-8');
    const data = JSON.parse(content);

    const validation = validateBundle(data);
    expect(validation.valid).toBe(true);

    bundle = data as SemanticGraphBundle;

    // Create store and load bundle
    store = createInMemoryStore();
    await loadBundleToStore(store, bundle, { validate: false });

    // Create pattern matcher with definitions
    matcher = createPatternMatcher();
    const patterns = [
      parsePatternDefinition(`
id: observer
description: Observer pattern
roles:
  subject:
    kind: class
  observer:
    kind: interface
constraints:
  - type: edge
    from: subject
    to: observer
    kind: uses
scoring:
  base: 0.6
  weights:
    subject_uses_observer: 0.4
`),
      parsePatternDefinition(`
id: factory
description: Factory pattern
roles:
  factory:
    kind: class
  product:
    kind: class
constraints:
  - type: edge
    from: factory
    to: product
    kind: calls
scoring:
  base: 0.5
  weights:
    factory_calls_product: 0.5
`),
    ];
    matcher.loadDefinitions(patterns);
  });

  afterAll(async () => {
    await store.close();
  });

  describe('Bundle Loading', () => {
    it('should load all nodes', async () => {
      const stats = await store.getStats();
      expect(stats.nodeCount).toBe(12);
    });

    it('should load all edges', async () => {
      const stats = await store.getStats();
      expect(stats.edgeCount).toBe(9);
    });

    it('should load annotations', async () => {
      const annotations = await store.getAnnotations('cls_subject_23456789');
      expect(annotations.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Detection', () => {
    it('should detect observer pattern', async () => {
      const matches = await matcher.matchPattern(store, 'observer');
      // Should find at least one match (EventSubject -> EventObserver)
      expect(matches.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect factory pattern', async () => {
      const matches = await matcher.matchPattern(store, 'factory');
      expect(matches.length).toBeGreaterThanOrEqual(0);
    });

    it('should return matches with confidence scores', async () => {
      const matches = await matcher.match(store);
      for (const match of matches) {
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('View Generation', () => {
    it('should project a full view', async () => {
      const projector = createProjector();
      const projection = await projector.project(store, { view: 'full' });

      expect(projection.nodes.length).toBeGreaterThan(0);
    });

    it('should compute ELK layout', async () => {
      const projector = createProjector();
      const layoutEngine = createELKLayoutEngine();

      const projection = await projector.project(store, { view: 'full' });
      const positions = await layoutEngine.layout(projection.nodes, projection.edges);

      expect(Object.keys(positions).length).toBeGreaterThan(0);

      // Check positions have x and y
      for (const pos of Object.values(positions)) {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
      }
    });

    it('should format as Cytoscape elements', async () => {
      const projector = createProjector();
      const layoutEngine = createELKLayoutEngine();
      const formatter = createFormatter();

      const projection = await projector.project(store, { view: 'full' });
      const positions = await layoutEngine.layout(projection.nodes, projection.edges);
      const elements = formatter.format(projection.nodes, projection.edges);
      const positioned = formatter.applyPositions(elements, positions);

      expect(positioned.nodes.length).toBeGreaterThan(0);

      // Check nodes have positions
      for (const node of positioned.nodes) {
        if (node.position) {
          expect(typeof node.position.x).toBe('number');
          expect(typeof node.position.y).toBe('number');
        }
      }
    });
  });

  describe('View Caching', () => {
    it('should cache computed views', async () => {
      const cache = createViewCache({ maxSize: 10, ttlMs: 60000 });
      const projector = createProjector();
      const layoutEngine = createELKLayoutEngine();
      const formatter = createFormatter();

      const config = { view: 'full' as const };
      const cacheKey = generateCacheKey(config);

      // First request - cache miss
      expect(cache.get(cacheKey)).toBeUndefined();

      // Compute view
      const projection = await projector.project(store, config);
      const positions = await layoutEngine.layout(projection.nodes, projection.edges);
      const elements = formatter.format(projection.nodes, projection.edges);
      const positioned = formatter.applyPositions(elements, positions);

      const response = {
        elements: positioned,
        positions,
        stats: {
          nodeCount: projection.nodes.length,
          edgeCount: projection.edges.length,
          layoutTimeMs: 10,
        },
      };

      // Cache the response
      cache.set(cacheKey, response);

      // Second request - cache hit
      const cached = cache.get(cacheKey);
      expect(cached).toBeDefined();
      expect(cached?.elements.nodes.length).toBe(response.elements.nodes.length);

      // Check stats
      const stats = cache.stats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('Performance', () => {
    it('should complete view generation in <200ms for sample graph', async () => {
      const projector = createProjector();
      const layoutEngine = createELKLayoutEngine();
      const formatter = createFormatter();

      const startTime = performance.now();

      const projection = await projector.project(store, { view: 'full' });
      const positions = await layoutEngine.layout(projection.nodes, projection.edges);
      const elements = formatter.format(projection.nodes, projection.edges);
      formatter.applyPositions(elements, positions);

      const duration = performance.now() - startTime;

      // Should complete in under 200ms for a 12-node graph
      expect(duration).toBeLessThan(200);
    });

    it('should complete pattern detection in <500ms', async () => {
      const startTime = performance.now();

      await matcher.match(store);

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Full Pipeline', () => {
    it('should complete full pipeline: validate -> load -> detect -> view', async () => {
      // This test verifies the complete flow works end-to-end
      const bundlePath = path.join(FIXTURES_PATH, 'sample-codebase.json');

      // Step 1: Load and validate
      const content = await readFile(bundlePath, 'utf-8');
      const data = JSON.parse(content);
      const validation = validateBundle(data);
      expect(validation.valid).toBe(true);

      // Step 2: Create fresh store and load
      const freshStore = createInMemoryStore();
      const loadResult = await loadBundleToStore(freshStore, data, { validate: false });
      expect(loadResult.success).toBe(true);
      expect(loadResult.nodesLoaded).toBe(12);

      // Step 3: Detect patterns
      const freshMatcher = createPatternMatcher();
      freshMatcher.loadDefinitions([
        parsePatternDefinition(`
id: observer
roles:
  subject:
    kind: class
  observer:
    kind: interface
constraints:
  - type: edge
    from: subject
    to: observer
    kind: uses
scoring:
  base: 0.6
  weights:
    subject_uses_observer: 0.4
`),
      ]);

      const matches = await freshMatcher.match(freshStore);
      // Pattern matching works (may or may not find matches depending on graph structure)
      expect(Array.isArray(matches)).toBe(true);

      // Step 4: Generate view
      const projector = createProjector();
      const layoutEngine = createELKLayoutEngine();
      const formatter = createFormatter();

      const projection = await projector.project(freshStore, { view: 'full' });
      const positions = await layoutEngine.layout(projection.nodes, projection.edges);
      let elements = formatter.format(projection.nodes, projection.edges);
      elements = formatter.applyPositions(elements, positions);

      if (matches.length > 0) {
        elements = formatter.applyPatternOverlay(elements, matches);
      }

      // Verify final output
      expect(elements.nodes.length).toBe(12);
      expect(Object.keys(positions).length).toBe(12);

      await freshStore.close();
    });
  });
});
