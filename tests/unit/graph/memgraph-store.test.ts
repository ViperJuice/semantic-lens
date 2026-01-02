/**
 * Tests for MemgraphStore implementation.
 *
 * These tests are designed to be skipped when Memgraph is not available.
 * In CI, you can either:
 * 1. Run a Memgraph container alongside tests
 * 2. Skip these tests with environment variable SKIP_MEMGRAPH_TESTS=1
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  MemgraphStore,
  createMemgraphStore,
  isMemgraphAvailable,
} from '../../../src/graph/memgraph-store';
import { GraphStoreError } from '../../../src/graph/store';
import type { MemgraphConfig } from '../../../src/graph/memgraph-store';

// Check if Memgraph is available for integration tests
const SKIP_INTEGRATION = process.env.SKIP_MEMGRAPH_TESTS === '1';

describe('MemgraphStore', () => {
  describe('configuration', () => {
    it('should use default configuration', () => {
      const store = new MemgraphStore();
      // Store should be instantiable without config
      expect(store).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const config: Partial<MemgraphConfig> = {
        host: 'custom-host',
        port: 9999,
        username: 'user',
        password: 'pass',
        database: 'custom-db',
      };
      const store = new MemgraphStore(config);
      expect(store).toBeDefined();
    });
  });

  describe('connection handling', () => {
    it('should throw CONNECTION_ERROR when database unavailable', async () => {
      const store = new MemgraphStore({
        host: 'nonexistent-host',
        port: 9999,
      });

      await expect(store.connect()).rejects.toThrow(GraphStoreError);
      await expect(store.connect()).rejects.toMatchObject({
        code: 'CONNECTION_ERROR',
      });
    });

    it('should throw CONNECTION_ERROR on operations when not connected', async () => {
      const store = new MemgraphStore();

      // All operations should fail when not connected
      await expect(store.getNode('test')).rejects.toThrow(GraphStoreError);
      await expect(store.getNode('test')).rejects.toMatchObject({
        code: 'CONNECTION_ERROR',
      });
    });
  });

  describe('isMemgraphAvailable helper', () => {
    it('should return false when Memgraph is not running', async () => {
      const available = await isMemgraphAvailable({
        host: 'nonexistent-host',
        port: 9999,
      });
      expect(available).toBe(false);
    });
  });

  describe('close', () => {
    it('should be callable even when not connected', async () => {
      const store = new MemgraphStore();
      // Should not throw
      await expect(store.close()).resolves.toBeUndefined();
    });
  });
});

// Integration tests - only run when Memgraph is available
describe.skipIf(SKIP_INTEGRATION)('MemgraphStore integration', () => {
  let store: MemgraphStore;
  let memgraphAvailable: boolean;

  beforeAll(async () => {
    memgraphAvailable = await isMemgraphAvailable();
  });

  beforeEach(async () => {
    if (!memgraphAvailable) {
      return;
    }
    store = new MemgraphStore();
    await store.connect();
    await store.clear();
  });

  afterAll(async () => {
    if (store) {
      await store.close();
    }
  });

  it.skipIf(!process.env.MEMGRAPH_HOST)('should connect to running Memgraph', async () => {
    // This test only runs if MEMGRAPH_HOST is set
    expect(memgraphAvailable).toBe(true);
  });
});

describe('createMemgraphStore factory', () => {
  it('should throw CONNECTION_ERROR for unavailable database', async () => {
    await expect(
      createMemgraphStore({
        host: 'nonexistent-host',
        port: 9999,
      })
    ).rejects.toThrow(GraphStoreError);
  });
});
