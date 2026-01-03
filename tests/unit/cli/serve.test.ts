/**
 * Serve Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serveCommand, createServerContext } from '../../../src/cli/commands/serve.js';

describe('serveCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('createServerContext', () => {
    it('should create server context with default options', async () => {
      const context = await createServerContext({});
      // Accept fallback if 3001 is unavailable
      expect(context.port).toBeGreaterThanOrEqual(3001);
      expect(context.port).toBeLessThanOrEqual(3100);
      expect(context.store).toBeDefined();
      expect(context.matcher).toBeDefined();
    });

    it('should use custom port when specified', async () => {
      // Use a high port that's less likely to be in use
      const context = await createServerContext({ port: '65420' });
      expect(context.port).toBe(65420);
    });

    it('should use environment variable port', async () => {
      process.env.VIEW_SERVICE_PORT = '65421';
      const context = await createServerContext({});
      expect(context.port).toBe(65421);
      delete process.env.VIEW_SERVICE_PORT;
    });

    it('should prioritize CLI flag over environment variable', async () => {
      process.env.VIEW_SERVICE_PORT = '65422';
      const context = await createServerContext({ port: '65423' });
      expect(context.port).toBe(65423);
      delete process.env.VIEW_SERVICE_PORT;
    });

    it('should reject invalid port', async () => {
      await expect(createServerContext({ port: 'invalid' })).rejects.toThrow(/Invalid port/);
      await expect(createServerContext({ port: '-1' })).rejects.toThrow(/Invalid port/);
      await expect(createServerContext({ port: '70000' })).rejects.toThrow(/Invalid port/);
    });

    it('should fallback to next port if default is unavailable', async () => {
      // Note: Testing actual port conflicts requires starting a server
      // This test just verifies the function completes without error
      const context = await createServerContext({});
      expect(context.port).toBeGreaterThanOrEqual(3001);
      expect(context.port).toBeLessThanOrEqual(3100);
    });
  });

  // Note: Full server tests are in the view-service tests
  // Here we just test the CLI command setup
});
