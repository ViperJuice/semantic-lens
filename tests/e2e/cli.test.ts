/**
 * CLI End-to-End Tests
 * Tests CLI commands with real files.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

const CLI_PATH = path.join(process.cwd(), 'dist', 'cli', 'index.js');
const FIXTURES_PATH = path.join(process.cwd(), 'tests', 'e2e', 'fixtures');
const TEMP_PATH = path.join(process.cwd(), 'tests', 'e2e', '.temp');

/**
 * Run the CLI with arguments.
 */
async function runCLI(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

describe('CLI E2E Tests', () => {
  beforeAll(async () => {
    // Ensure temp directory exists
    await mkdir(TEMP_PATH, { recursive: true });
  });

  afterAll(async () => {
    // Clean up temp files
    try {
      await unlink(path.join(TEMP_PATH, 'patterns-output.json'));
    } catch {
      // Ignore
    }
    try {
      await unlink(path.join(TEMP_PATH, 'export-output.json'));
    } catch {
      // Ignore
    }
  });

  describe('--help', () => {
    it('should display help text', async () => {
      const result = await runCLI(['--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('semantic-lens');
      expect(result.stdout).toContain('validate');
      expect(result.stdout).toContain('load');
      expect(result.stdout).toContain('patterns');
      expect(result.stdout).toContain('serve');
      expect(result.stdout).toContain('export');
    });
  });

  describe('--version', () => {
    it('should display version', async () => {
      const result = await runCLI(['--version']);
      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('validate command', () => {
    it('should validate a valid bundle', async () => {
      const bundlePath = path.join(FIXTURES_PATH, 'sample-codebase.json');
      const result = await runCLI(['validate', bundlePath]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Valid');
    });

    it('should reject an invalid bundle', async () => {
      // Create a temp invalid bundle
      const invalidPath = path.join(TEMP_PATH, 'invalid-bundle.json');
      await writeFile(invalidPath, JSON.stringify({ version: 'invalid' }));

      const result = await runCLI(['validate', invalidPath]);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Validation failed');

      await unlink(invalidPath);
    });

    it('should handle missing file', async () => {
      const result = await runCLI(['validate', '/nonexistent/file.json']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Failed to read file');
    });
  });

  describe('load command', () => {
    it('should load a valid bundle', async () => {
      const bundlePath = path.join(FIXTURES_PATH, 'sample-codebase.json');
      const result = await runCLI(['load', bundlePath]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Load complete');
      expect(result.stdout).toContain('nodes');
      expect(result.stdout).toContain('edges');
    });

    it('should report load statistics', async () => {
      const bundlePath = path.join(FIXTURES_PATH, 'sample-codebase.json');
      const result = await runCLI(['load', bundlePath]);
      expect(result.code).toBe(0);
      // Check for node count (12 nodes in sample)
      expect(result.stdout).toMatch(/Loaded \d+ nodes/);
      expect(result.stdout).toMatch(/Loaded \d+ edges/);
    });
  });

  describe('patterns command', () => {
    it('should detect patterns in a bundle', async () => {
      const bundlePath = path.join(FIXTURES_PATH, 'sample-codebase.json');
      const outputPath = path.join(TEMP_PATH, 'patterns-output.json');

      const result = await runCLI(['patterns', '--bundle', bundlePath, '--output', outputPath]);
      expect(result.code).toBe(0);

      // Check output file exists and is valid JSON
      const output = await readFile(outputPath, 'utf-8');
      const data = JSON.parse(output);
      expect(data.bundle).toBe(bundlePath);
      expect(typeof data.matchCount).toBe('number');
      expect(Array.isArray(data.matches)).toBe(true);
    });

    it('should require --bundle flag', async () => {
      const result = await runCLI(['patterns']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('bundle');
    });
  });

  describe('export command', () => {
    it('should export a view to JSON', async () => {
      // Create a view config
      const bundlePath = path.join(FIXTURES_PATH, 'sample-codebase.json');
      const configPath = path.join(TEMP_PATH, 'view-config.json');
      const outputPath = path.join(TEMP_PATH, 'export-output.json');

      await writeFile(
        configPath,
        JSON.stringify({
          view: 'full',
          bundle: bundlePath,
        })
      );

      const result = await runCLI(['export', configPath, '--format', 'json', '--output', outputPath]);
      expect(result.code).toBe(0);

      // Check output
      const output = await readFile(outputPath, 'utf-8');
      const data = JSON.parse(output);
      expect(data.elements).toBeDefined();
      expect(data.positions).toBeDefined();
      expect(data.stats).toBeDefined();

      await unlink(configPath);
    });
  });

  describe('unknown command', () => {
    it('should return error for unknown command', async () => {
      const result = await runCLI(['unknown-command']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Unknown command');
    });
  });
});
