/**
 * Patterns Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { patternsCommand } from '../../../src/cli/commands/patterns.js';

describe('patternsCommand', () => {
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

  it('should return 1 for missing bundle', async () => {
    const code = await patternsCommand({});
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('bundle'));
  });

  it('should return 1 for nonexistent bundle file', async () => {
    const code = await patternsCommand({ bundle: '/nonexistent/bundle.json' });
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read bundle'));
  });

  // Full pattern detection is tested in E2E tests with real fixtures
});
