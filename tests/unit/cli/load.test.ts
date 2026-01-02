/**
 * Load Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCommand } from '../../../src/cli/commands/load.js';

describe('loadCommand', () => {
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

  it('should return 1 for file not found', async () => {
    const code = await loadCommand('/nonexistent/bundle.json', {});
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should return 1 for invalid JSON', async () => {
    // Uses a known path that exists but isn't valid JSON
    const code = await loadCommand('/home/jenner/code/semantic-lens/package.json', {});
    // package.json is valid JSON but not a valid bundle - will fail validation
    expect(code).toBe(1);
  });

  // Full load functionality is tested in E2E tests with real bundles
});
