/**
 * CLI Entry Point Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, main, showHelp, showVersion } from '../../../src/cli/index.js';

describe('CLI', () => {
  describe('parseArgs', () => {
    it('should parse validate command with file path', () => {
      const result = parseArgs(['validate', 'bundle.json']);
      expect(result.command).toBe('validate');
      expect(result.args).toEqual(['bundle.json']);
    });

    it('should parse load command with file path', () => {
      const result = parseArgs(['load', 'bundle.json']);
      expect(result.command).toBe('load');
      expect(result.args).toEqual(['bundle.json']);
    });

    it('should parse load command with options', () => {
      const result = parseArgs(['load', 'bundle.json', '--db', 'bolt://localhost:7687', '--clear']);
      expect(result.command).toBe('load');
      expect(result.args).toEqual(['bundle.json']);
      expect(result.options.db).toBe('bolt://localhost:7687');
      expect(result.options.clear).toBe(true);
    });

    it('should parse patterns command', () => {
      const result = parseArgs(['patterns']);
      expect(result.command).toBe('patterns');
    });

    it('should parse patterns command with options', () => {
      const result = parseArgs(['patterns', '--output', 'results.json', '--pattern', 'observer']);
      expect(result.command).toBe('patterns');
      expect(result.options.output).toBe('results.json');
      expect(result.options.pattern).toBe('observer');
    });

    it('should parse serve command', () => {
      const result = parseArgs(['serve']);
      expect(result.command).toBe('serve');
    });

    it('should parse serve command with port', () => {
      const result = parseArgs(['serve', '--port', '3001']);
      expect(result.command).toBe('serve');
      expect(result.options.port).toBe('3001');
    });

    it('should parse export command', () => {
      const result = parseArgs(['export', 'view-config.json']);
      expect(result.command).toBe('export');
      expect(result.args).toEqual(['view-config.json']);
    });

    it('should parse export command with format', () => {
      const result = parseArgs(['export', 'view-config.json', '--format', 'json']);
      expect(result.command).toBe('export');
      expect(result.options.format).toBe('json');
    });

    it('should parse help flag', () => {
      const result = parseArgs(['--help']);
      expect(result.command).toBe('help');
    });

    it('should parse -h flag', () => {
      const result = parseArgs(['-h']);
      expect(result.command).toBe('help');
    });

    it('should parse version flag', () => {
      const result = parseArgs(['--version']);
      expect(result.command).toBe('version');
    });

    it('should parse -v flag', () => {
      const result = parseArgs(['-v']);
      expect(result.command).toBe('version');
    });

    it('should return help for empty args', () => {
      const result = parseArgs([]);
      expect(result.command).toBe('help');
    });

    it('should handle unknown command', () => {
      const result = parseArgs(['unknown']);
      expect(result.command).toBe('unknown');
      expect(result.error).toBe(true);
    });
  });

  describe('showHelp', () => {
    it('should return help text', () => {
      const help = showHelp();
      expect(help).toContain('semantic-lens');
      expect(help).toContain('validate');
      expect(help).toContain('load');
      expect(help).toContain('patterns');
      expect(help).toContain('serve');
      expect(help).toContain('export');
    });
  });

  describe('showVersion', () => {
    it('should return version string', () => {
      const version = showVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('main', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should show help and return 0 for --help', async () => {
      const code = await main(['--help']);
      expect(code).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should show version and return 0 for --version', async () => {
      const code = await main(['--version']);
      expect(code).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should return 1 for unknown command', async () => {
      const code = await main(['unknown']);
      expect(code).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
