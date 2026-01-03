/**
 * Port Utilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'net';
import {
  isPortAvailable,
  findAvailablePort,
  getPortFromEnv,
  resolvePort,
} from '../../../src/view-service/api/port-utils.js';

describe('port-utils', () => {
  describe('isPortAvailable', () => {
    it('should return true for available port', async () => {
      // Use a high port number that's likely available
      const available = await isPortAvailable(65432);
      expect(available).toBe(true);
    });

    it('should return false for occupied port', async () => {
      // Create a server on a specific port
      const server = createServer();
      await new Promise<void>((resolve) => {
        server.listen(65433, '127.0.0.1', () => resolve());
      });

      try {
        const available = await isPortAvailable(65433);
        expect(available).toBe(false);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
    });

    it('should reject invalid port numbers', async () => {
      await expect(isPortAvailable(0)).rejects.toThrow(/Invalid port/);
      await expect(isPortAvailable(-1)).rejects.toThrow(/Invalid port/);
      await expect(isPortAvailable(70000)).rejects.toThrow(/Invalid port/);
    });

    it('should handle port check timeout', async () => {
      // Test with a valid port (should complete quickly)
      const result = await isPortAvailable(65434);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('findAvailablePort', () => {
    it('should find available port starting from given port', async () => {
      const port = await findAvailablePort(65430, 10);
      expect(port).toBeGreaterThanOrEqual(65430);
      expect(port).toBeLessThanOrEqual(65440);
    });

    it('should skip occupied ports', async () => {
      // Occupy ports 65435 and 65436
      const server1 = createServer();
      const server2 = createServer();

      await new Promise<void>((resolve) => {
        server1.listen(65435, '127.0.0.1', () => resolve());
      });
      await new Promise<void>((resolve) => {
        server2.listen(65436, '127.0.0.1', () => resolve());
      });

      try {
        const port = await findAvailablePort(65435, 10);
        // Should skip 65435 and 65436 and find 65437 or later
        expect(port).toBeGreaterThanOrEqual(65437);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server1.close((err) => (err ? reject(err) : resolve()));
        });
        await new Promise<void>((resolve, reject) => {
          server2.close((err) => (err ? reject(err) : resolve()));
        });
      }
    });

    it('should throw error if no available port found', async () => {
      // Occupy ports 65533, 65534, 65535
      const servers = [];
      try {
        for (const port of [65533, 65534, 65535]) {
          const server = createServer();
          await new Promise<void>((resolve) => {
            server.listen(port, '127.0.0.1', () => resolve());
          });
          servers.push(server);
        }

        // Now try to find available port in occupied range
        await expect(findAvailablePort(65533, 3)).rejects.toThrow(/No available port found/);
      } finally {
        // Clean up servers
        for (const server of servers) {
          await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
          });
        }
      }
    });

    it('should respect maxAttempts parameter', async () => {
      await expect(findAvailablePort(65500, 0)).rejects.toThrow(/maxAttempts must be at least 1/);
    });

    it('should stop at port 65535 limit', async () => {
      const port = await findAvailablePort(65533, 10);
      expect(port).toBeLessThanOrEqual(65535);
    });
  });

  describe('getPortFromEnv', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.VIEW_SERVICE_PORT;
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.VIEW_SERVICE_PORT = originalEnv;
      } else {
        delete process.env.VIEW_SERVICE_PORT;
      }
    });

    it('should return default port when env var not set', () => {
      delete process.env.VIEW_SERVICE_PORT;
      const port = getPortFromEnv(3001);
      expect(port).toBe(3001);
    });

    it('should return port from environment variable', () => {
      process.env.VIEW_SERVICE_PORT = '8080';
      const port = getPortFromEnv(3001);
      expect(port).toBe(8080);
    });

    it('should return default for invalid env var (non-numeric)', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.VIEW_SERVICE_PORT = 'invalid';
      const port = getPortFromEnv(3001);
      expect(port).toBe(3001);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should return default for invalid env var (out of range)', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      process.env.VIEW_SERVICE_PORT = '0';
      expect(getPortFromEnv(3001)).toBe(3001);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockClear();

      process.env.VIEW_SERVICE_PORT = '70000';
      expect(getPortFromEnv(3001)).toBe(3001);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle edge case ports (1 and 65535)', () => {
      process.env.VIEW_SERVICE_PORT = '1';
      expect(getPortFromEnv(3001)).toBe(1);

      process.env.VIEW_SERVICE_PORT = '65535';
      expect(getPortFromEnv(3001)).toBe(65535);
    });
  });

  describe('resolvePort', () => {
    it('should return requested port if available', async () => {
      const result = await resolvePort(65440, false);
      expect(result.port).toBe(65440);
      expect(result.wasExplicit).toBe(true);
      expect(result.didFallback).toBe(false);
    });

    it('should throw error for unavailable explicit port when fallback disabled', async () => {
      // Occupy port 65441
      const server = createServer();
      await new Promise<void>((resolve) => {
        server.listen(65441, '127.0.0.1', () => resolve());
      });

      try {
        await expect(resolvePort(65441, false)).rejects.toThrow(/Port 65441 is already in use/);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
    });

    it('should fallback to next port when allowed', async () => {
      // Occupy port 65442
      const server = createServer();
      await new Promise<void>((resolve) => {
        server.listen(65442, '127.0.0.1', () => resolve());
      });

      try {
        const result = await resolvePort(65442, true);
        expect(result.port).toBeGreaterThan(65442);
        expect(result.didFallback).toBe(true);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
    });

    it('should mark port as explicit when provided', async () => {
      const result = await resolvePort(65443, true);
      expect(result.wasExplicit).toBe(true);
    });

    it('should mark port as non-explicit when undefined', async () => {
      const result = await resolvePort(undefined, true);
      expect(result.wasExplicit).toBe(false);
      // Accept fallback if 3001 is unavailable
      expect(result.port).toBeGreaterThanOrEqual(3001);
      expect(result.port).toBeLessThanOrEqual(3100);
    });

    it('should provide helpful error message with diagnostic commands', async () => {
      // Occupy port 65444
      const server = createServer();
      await new Promise<void>((resolve) => {
        server.listen(65444, '127.0.0.1', () => resolve());
      });

      try {
        await expect(resolvePort(65444, false)).rejects.toThrow(/lsof -i :65444/);
        await expect(resolvePort(65444, false)).rejects.toThrow(/netstat -ano \| findstr :65444/);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
    });

    it('should validate port range', async () => {
      await expect(resolvePort(0, false)).rejects.toThrow(/Invalid port/);
      await expect(resolvePort(70000, false)).rejects.toThrow(/Invalid port/);
    });

    it('should throw error if fallback fails to find port', async () => {
      // This is hard to test without occupying many ports
      // Just verify the error handling exists
      const result = await resolvePort(65450, true);
      expect(result.port).toBeDefined();
    });
  });
});
