/**
 * View Cache Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createViewCache, type ViewCache } from '../../../src/view-service/cache/view-cache.js';
import type { ViewResponse } from '../../../src/view-service/types.js';

describe('ViewCache', () => {
  let cache: ViewCache;

  const mockViewResponse: ViewResponse = {
    elements: {
      nodes: [{ data: { id: 'n1' } }],
      edges: [],
    },
    positions: { n1: { x: 0, y: 0 } },
    stats: {
      nodeCount: 1,
      edgeCount: 0,
      layoutTimeMs: 10,
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    cache = createViewCache({ maxSize: 3, ttlMs: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get/set operations', () => {
    it('should store and retrieve a value', () => {
      cache.set('key1', mockViewResponse);
      const result = cache.get('key1');
      expect(result).toEqual(mockViewResponse);
    });

    it('should return undefined for missing key', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should overwrite existing key', () => {
      const newResponse = { ...mockViewResponse, stats: { ...mockViewResponse.stats, nodeCount: 5 } };
      cache.set('key1', mockViewResponse);
      cache.set('key1', newResponse);
      const result = cache.get('key1');
      expect(result?.stats.nodeCount).toBe(5);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used when at max size', () => {
      cache.set('key1', mockViewResponse);
      cache.set('key2', mockViewResponse);
      cache.set('key3', mockViewResponse);

      // Access key1 to make it recently used
      cache.get('key1');

      // Add key4, should evict key2 (least recently used)
      cache.set('key4', mockViewResponse);

      expect(cache.get('key1')).toBeDefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeDefined();
      expect(cache.get('key4')).toBeDefined();
    });

    it('should update access time on get', () => {
      cache.set('key1', mockViewResponse);
      cache.set('key2', mockViewResponse);
      cache.set('key3', mockViewResponse);

      // Access key1 multiple times
      cache.get('key1');
      cache.get('key1');

      // Add more items
      cache.set('key4', mockViewResponse);
      cache.set('key5', mockViewResponse);

      // key1 should still exist as it was accessed recently
      expect(cache.get('key1')).toBeDefined();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('key1', mockViewResponse);
      expect(cache.get('key1')).toBeDefined();

      // Advance time past TTL
      vi.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      cache.set('key1', mockViewResponse);

      // Advance time but not past TTL
      vi.advanceTimersByTime(500);

      expect(cache.get('key1')).toBeDefined();
    });

    it('should support custom TTL per entry', () => {
      cache.set('key1', mockViewResponse, 500);
      cache.set('key2', mockViewResponse, 2000);

      vi.advanceTimersByTime(600);

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeDefined();
    });
  });

  describe('invalidate', () => {
    it('should remove specific entry', () => {
      cache.set('key1', mockViewResponse);
      cache.set('key2', mockViewResponse);

      cache.invalidate('key1');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeDefined();
    });

    it('should do nothing for nonexistent key', () => {
      cache.set('key1', mockViewResponse);
      cache.invalidate('nonexistent');
      expect(cache.get('key1')).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', mockViewResponse);
      cache.set('key2', mockViewResponse);
      cache.set('key3', mockViewResponse);

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
    });

    it('should reset stats', () => {
      cache.set('key1', mockViewResponse);
      cache.get('key1');
      cache.get('nonexistent');

      cache.clear();

      const stats = cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('stats', () => {
    it('should track hits', () => {
      cache.set('key1', mockViewResponse);
      cache.get('key1');
      cache.get('key1');

      const stats = cache.stats();
      expect(stats.hits).toBe(2);
    });

    it('should track misses', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');

      const stats = cache.stats();
      expect(stats.misses).toBe(2);
    });

    it('should track size', () => {
      cache.set('key1', mockViewResponse);
      cache.set('key2', mockViewResponse);

      const stats = cache.stats();
      expect(stats.size).toBe(2);
    });

    it('should report maxSize', () => {
      const stats = cache.stats();
      expect(stats.maxSize).toBe(3);
    });

    it('should count expired entry access as miss', () => {
      cache.set('key1', mockViewResponse);
      cache.get('key1'); // hit

      vi.advanceTimersByTime(1001);

      cache.get('key1'); // miss (expired)

      const stats = cache.stats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('default options', () => {
    it('should use defaults when no options provided', () => {
      const defaultCache = createViewCache();
      const stats = defaultCache.stats();
      expect(stats.maxSize).toBe(100); // default maxSize
    });
  });
});
