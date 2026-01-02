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
    it('should create server context with default options', () => {
      const context = createServerContext({});
      expect(context.port).toBe(3000);
      expect(context.store).toBeDefined();
      expect(context.matcher).toBeDefined();
    });

    it('should use custom port when specified', () => {
      const context = createServerContext({ port: '3001' });
      expect(context.port).toBe(3001);
    });
  });

  // Note: Full server tests are in the view-service tests
  // Here we just test the CLI command setup
});
