#!/usr/bin/env node
/**
 * Scans a directory for git repositories and generates a fixture manifest.
 * Usage: node scripts/generate-fixture-manifest.js [path]
 * Default path: ~/code
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Expands ~ to home directory
 */
function expandHome(filepath) {
  if (filepath.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE, filepath.slice(2));
  }
  return filepath;
}

/**
 * Checks if a directory is a git repository
 */
function isGitRepo(dirPath) {
  try {
    const gitDir = path.join(dirPath, '.git');
    return fs.existsSync(gitDir);
  } catch {
    return false;
  }
}

/**
 * Gets git remote URL if available
 */
function getRemoteUrl(dirPath) {
  try {
    const url = execSync('git config --get remote.origin.url', {
      cwd: dirPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return url || null;
  } catch {
    return null;
  }
}

/**
 * Gets the last commit date
 */
function getLastCommitDate(dirPath) {
  try {
    const date = execSync('git log -1 --format=%ci', {
      cwd: dirPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return date || null;
  } catch {
    return null;
  }
}

/**
 * Checks if a .slb fixture exists for this repo
 */
function hasFixture(repoName, fixturesDir) {
  const fixturePath = path.join(fixturesDir, `${repoName}.slb`);
  return fs.existsSync(fixturePath);
}

/**
 * Scans a directory for git repositories
 */
function scanForRepos(scanPath) {
  const repos = [];

  try {
    const entries = fs.readdirSync(scanPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Skip hidden directories except .git
      if (entry.name.startsWith('.') && entry.name !== '.git') continue;

      const fullPath = path.join(scanPath, entry.name);

      if (isGitRepo(fullPath)) {
        const repoName = entry.name;
        const remoteUrl = getRemoteUrl(fullPath);
        const lastCommit = getLastCommitDate(fullPath);

        repos.push({
          name: repoName,
          path: fullPath,
          remoteUrl,
          lastCommit,
          enabled: true, // Default to enabled
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning ${scanPath}:`, error.message);
  }

  return repos;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const scanPath = args[0] || '~/code';
  const expandedPath = expandHome(scanPath);

  console.log(`Scanning for git repositories in: ${expandedPath}`);

  if (!fs.existsSync(expandedPath)) {
    console.error(`Error: Directory does not exist: ${expandedPath}`);
    process.exit(1);
  }

  const repos = scanForRepos(expandedPath);

  console.log(`Found ${repos.length} repositories`);

  // Check which repos have existing fixtures
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  repos.forEach(repo => {
    repo.hasFixture = hasFixture(repo.name, fixturesDir);
    if (repo.hasFixture) {
      console.log(`  ✓ ${repo.name} (fixture exists)`);
    } else {
      console.log(`  - ${repo.name} (no fixture)`);
    }
  });

  // Generate manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    scanPath: expandedPath,
    repos,
  };

  // Write manifest to fixtures directory
  const manifestPath = path.join(fixturesDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\nManifest written to: ${manifestPath}`);
  console.log(`\nTo generate fixtures for repos without them, run:`);
  console.log(`  npx semantic-lens analyze <repo-path> --output fixtures/<repo-name>.slb`);
}

main();
