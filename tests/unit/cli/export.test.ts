/**
 * Export Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportCommand } from '../../../src/cli/commands/export.js';

describe('exportCommand', () => {
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

  it('should return 1 for missing config file', async () => {
    const code = await exportCommand('/nonexistent/config.json', {});
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should return 1 for invalid format', async () => {
    // Create a temp config file inline test
    const code = await exportCommand('/home/jenner/code/semantic-lens/package.json', { format: 'invalid' });
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid format'));
  });

  // Full export functionality is tested in E2E tests
});
