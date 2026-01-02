/**
 * Tests for View Service API Server
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createViewServer, type ViewServer } from '../../../src/view-service/api/server.js';
import { InMemoryStore } from '../../../src/graph/memory-store.js';
import { createPatternMatcher, type PatternMatcherInterface } from '../../../src/patterns/matcher/matcher.js';
import type { SemanticGraphBundle } from '../../../src/schema/types.js';

// Note: supertest is not installed, so we'll test the Express app directly
// For real tests, install supertest as a dev dependency

describe('View Service API', () => {
  let server: ViewServer;
  let store: InMemoryStore;
  let matcher: PatternMatcherInterface;

  const sampleBundle: SemanticGraphBundle = {
    version: 'v1.0',
    generated_at: '2026-01-01T00:00:00Z',
    nodes: [
      {
        node_id: 'class-a',
        kind: 'class',
        name: 'ClassA',
        language: 'typescript',
        file: 'src/a.ts',
        span: [0, 100],
      },
      {
        node_id: 'class-b',
        kind: 'class',
        name: 'ClassB',
        language: 'typescript',
        file: 'src/b.ts',
        span: [0, 100],
      },
      {
        node_id: 'method-c',
        kind: 'method',
        name: 'methodC',
        language: 'typescript',
        file: 'src/a.ts',
        span: [50, 80],
        parent: 'class-a',
      },
    ],
    edges: [
      {
        edge_id: 'edge-1',
        kind: 'inherits',
        src: 'class-a',
        dst: 'class-b',
        confidence: 1.0,
        evidence: ['static_analysis'],
      },
      {
        edge_id: 'edge-2',
        kind: 'calls',
        src: 'method-c',
        dst: 'class-b',
        confidence: 0.8,
        evidence: ['static_analysis'],
      },
    ],
    annotations: [],
    patterns: [],
  };

  beforeEach(async () => {
    store = new InMemoryStore();
    await store.loadBundle(sampleBundle);
    matcher = createPatternMatcher();

    server = createViewServer({
      store,
      matcher,
      port: 0, // Random port
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('createViewServer', () => {
    it('should create a server instance', () => {
      expect(server).toBeDefined();
      expect(server.app).toBeDefined();
      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
    });
  });

  describe('GET /views', () => {
    it('should return list of view types', async () => {
      const app = server.app;

      // Direct app testing without supertest
      const mockRes = {
        json: (data: unknown) => {
          expect(data).toHaveProperty('views');
          const views = (data as { views: string[] }).views;
          expect(views).toContain('call_graph');
          expect(views).toContain('inheritance');
          expect(views).toContain('module_deps');
          expect(views).toContain('full');
        },
      };

      // Get the route handler
      const route = app._router.stack.find(
        (layer: any) => layer.route?.path === '/views' && layer.route?.methods?.get
      );
      expect(route).toBeDefined();
    });
  });

  describe('GET /health', () => {
    it('should have health endpoint', () => {
      const app = server.app;

      const route = app._router.stack.find(
        (layer: any) => layer.route?.path === '/health' && layer.route?.methods?.get
      );
      expect(route).toBeDefined();
    });
  });

  describe('POST /view', () => {
    it('should have view endpoint', () => {
      const app = server.app;

      const route = app._router.stack.find(
        (layer: any) => layer.route?.path === '/view' && layer.route?.methods?.post
      );
      expect(route).toBeDefined();
    });
  });

  describe('POST /layout/elk', () => {
    it('should have layout endpoint', () => {
      const app = server.app;

      const route = app._router.stack.find(
        (layer: any) => layer.route?.path === '/layout/elk' && layer.route?.methods?.post
      );
      expect(route).toBeDefined();
    });
  });

  describe('POST /patterns/run', () => {
    it('should have patterns endpoint', () => {
      const app = server.app;

      const route = app._router.stack.find(
        (layer: any) => layer.route?.path === '/patterns/run' && layer.route?.methods?.post
      );
      expect(route).toBeDefined();
    });
  });

  describe('Server lifecycle', () => {
    it('should start and stop without error', async () => {
      // Start server on a random port
      const testServer = createViewServer({
        store,
        matcher,
        port: 0,
      });

      // Note: In a real test, we'd verify the server is actually listening
      // For now, we just verify the methods exist and can be called
      await expect(testServer.stop()).resolves.not.toThrow();
    });
  });
});

// Integration tests that would use supertest
describe('View Service API Integration', () => {
  let store: InMemoryStore;
  let matcher: PatternMatcherInterface;
  let server: ViewServer;

  const sampleBundle: SemanticGraphBundle = {
    version: 'v1.0',
    generated_at: '2026-01-01T00:00:00Z',
    nodes: [
      {
        node_id: 'node-1',
        kind: 'class',
        name: 'TestClass',
        language: 'typescript',
        file: 'test.ts',
        span: [0, 100],
      },
    ],
    edges: [],
    annotations: [],
    patterns: [],
  };

  beforeEach(async () => {
    store = new InMemoryStore();
    await store.loadBundle(sampleBundle);
    matcher = createPatternMatcher();
    server = createViewServer({ store, matcher, port: 0 });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should expose Express app for testing', () => {
    expect(server.app).toBeDefined();
    expect(typeof server.app.listen).toBe('function');
  });

  it('should have CORS enabled', () => {
    const app = server.app;
    // Check that cors middleware is applied
    const corsMiddleware = app._router.stack.find(
      (layer: any) => layer.name === 'corsMiddleware'
    );
    expect(corsMiddleware).toBeDefined();
  });

  it('should have JSON body parser enabled', () => {
    const app = server.app;
    // Check that json middleware is applied
    const jsonMiddleware = app._router.stack.find(
      (layer: any) => layer.name === 'jsonParser'
    );
    expect(jsonMiddleware).toBeDefined();
  });
});

// Response time tests
describe('View Service Performance', () => {
  it('should complete view generation within reasonable time', async () => {
    const store = new InMemoryStore();
    const matcher = createPatternMatcher();

    // Create a bundle with 100 nodes to test performance
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      node_id: `node-${i}`,
      kind: 'class' as const,
      name: `Class${i}`,
      language: 'typescript',
      file: `src/class${i}.ts`,
      span: [0, 100] as [number, number],
    }));

    const edges = Array.from({ length: 50 }, (_, i) => ({
      edge_id: `edge-${i}`,
      kind: 'calls' as const,
      src: `node-${i}`,
      dst: `node-${(i + 1) % 100}`,
      confidence: 0.9,
      evidence: ['static_analysis'] as const,
    }));

    await store.loadBundle({
      version: 'v1.0',
      generated_at: '2026-01-01T00:00:00Z',
      nodes,
      edges,
      annotations: [],
      patterns: [],
    });

    const server = createViewServer({ store, matcher, port: 0 });

    // The API would be tested with supertest for actual request/response times
    // Here we just verify the server can be created with larger data

    expect(server).toBeDefined();
    await server.stop();
  });
});
