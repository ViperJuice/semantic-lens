/**
 * Validate Command Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateCommand } from '../../../src/cli/commands/validate.js';

describe('validateCommand', () => {
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

  it('should return 0 for valid bundle (fixtures/valid-bundle.json)', async () => {
    const code = await validateCommand('/home/jenner/code/semantic-lens/fixtures/valid-bundle.json');
    expect(code).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Valid'));
  });

  it('should return 1 for invalid bundle (fixtures/invalid-bundle.json)', async () => {
    const code = await validateCommand('/home/jenner/code/semantic-lens/fixtures/invalid-bundle.json');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should return 1 for file not found', async () => {
    const code = await validateCommand('/nonexistent/file.json');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read file'));
  });

  it('should return 1 for non-JSON file', async () => {
    // package.json is valid JSON but not a valid bundle schema
    const code = await validateCommand('/home/jenner/code/semantic-lens/package.json');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
  });
});
