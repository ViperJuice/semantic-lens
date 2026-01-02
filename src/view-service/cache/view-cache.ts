/**
 * View Cache
 * LRU cache for computed ViewResponse objects with TTL support.
 */

import type { ViewResponse } from '../types.js';

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Current number of entries */
  size: number;
  /** Maximum number of entries */
  maxSize: number;
}

/**
 * View cache interface.
 */
export interface ViewCache {
  /**
   * Get a cached view response.
   * @param key - Cache key
   * @returns Cached response or undefined if not found/expired
   */
  get(key: string): ViewResponse | undefined;

  /**
   * Store a view response in cache.
   * @param key - Cache key
   * @param value - View response to cache
   * @param ttlMs - Optional TTL override in milliseconds
   */
  set(key: string, value: ViewResponse, ttlMs?: number): void;

  /**
   * Remove a specific entry from cache.
   * @param key - Cache key to invalidate
   */
  invalidate(key: string): void;

  /**
   * Clear all cache entries.
   */
  clear(): void;

  /**
   * Get cache statistics.
   */
  stats(): CacheStats;
}

/**
 * Options for creating a view cache.
 */
export interface ViewCacheOptions {
  /** Maximum number of entries (default: 100) */
  maxSize?: number;
  /** Default TTL in milliseconds (default: 5 minutes) */
  ttlMs?: number;
}

/**
 * Internal cache entry.
 */
interface CacheEntry {
  value: ViewResponse;
  expiresAt: number;
  accessOrder: number;
}

/**
 * Create an LRU view cache.
 * @param options - Cache options
 * @returns View cache instance
 */
export function createViewCache(options: ViewCacheOptions = {}): ViewCache {
  const maxSize = options.maxSize ?? 100;
  const defaultTtlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes

  const cache = new Map<string, CacheEntry>();
  let hits = 0;
  let misses = 0;
  let accessCounter = 0; // Monotonically increasing for LRU ordering

  /**
   * Evict least recently used entries until under max size.
   */
  function evictLRU(): void {
    while (cache.size >= maxSize) {
      let oldestKey: string | null = null;
      let oldestAccess = Infinity;

      for (const [key, entry] of cache.entries()) {
        if (entry.accessOrder < oldestAccess) {
          oldestAccess = entry.accessOrder;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  /**
   * Check if an entry is expired.
   */
  function isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  return {
    get(key: string): ViewResponse | undefined {
      const entry = cache.get(key);

      if (!entry) {
        misses++;
        return undefined;
      }

      if (isExpired(entry)) {
        cache.delete(key);
        misses++;
        return undefined;
      }

      // Update access order for LRU
      entry.accessOrder = ++accessCounter;
      hits++;

      return entry.value;
    },

    set(key: string, value: ViewResponse, ttlMs?: number): void {
      // If key already exists, update it
      if (cache.has(key)) {
        const entry = cache.get(key)!;
        entry.value = value;
        entry.expiresAt = Date.now() + (ttlMs ?? defaultTtlMs);
        entry.accessOrder = ++accessCounter;
        return;
      }

      // Evict if at capacity
      if (cache.size >= maxSize) {
        evictLRU();
      }

      // Add new entry
      cache.set(key, {
        value,
        expiresAt: Date.now() + (ttlMs ?? defaultTtlMs),
        accessOrder: ++accessCounter,
      });
    },

    invalidate(key: string): void {
      cache.delete(key);
    },

    clear(): void {
      cache.clear();
      hits = 0;
      misses = 0;
    },

    stats(): CacheStats {
      // Clean up expired entries before reporting size
      for (const [key, entry] of cache.entries()) {
        if (isExpired(entry)) {
          cache.delete(key);
        }
      }

      return {
        hits,
        misses,
        size: cache.size,
        maxSize,
      };
    },
  };
}

/**
 * Generate a cache key from view config.
 * @param config - View configuration
 * @returns Cache key string
 */
export function generateCacheKey(config: Record<string, unknown>): string {
  // Sort keys for consistent ordering
  const sortedConfig = Object.keys(config)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = config[key];
        return acc;
      },
      {} as Record<string, unknown>
    );

  return JSON.stringify(sortedConfig);
}
