/**
 * Load Command
 * Loads a SemanticGraphBundle into a graph store.
 */

import { readFile } from 'fs/promises';
import { validateBundle } from '../../schema/validator.js';
import { createInMemoryStore } from '../../graph/memory-store.js';
import { loadBundleToStore } from '../../graph/loader.js';
import type { SemanticGraphBundle } from '../../schema/types.js';

/**
 * Options for the load command.
 */
export interface LoadCommandOptions {
  /** Database URI (default: in-memory) */
  db?: string;
  /** Clear store before loading */
  clear?: boolean;
}

/**
 * Run the load command.
 * @param filePath - Path to the bundle JSON file
 * @param options - Load options
 * @returns Exit code (0 = success, 1 = error)
 */
export async function loadCommand(
  filePath: string,
  options: LoadCommandOptions
): Promise<number> {
  try {
    // Read the file
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`);
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to parse JSON: ${filePath}`);
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Validate first
    const validationResult = validateBundle(data);
    if (!validationResult.valid) {
      console.error(`Validation failed: ${filePath}`);
      if (validationResult.errors) {
        for (const error of validationResult.errors) {
          console.error(`  ${error.path}: ${error.message}`);
        }
      }
      return 1;
    }

    const bundle = data as SemanticGraphBundle;

    // Create store
    // For now, only in-memory store is fully supported
    // Memgraph store would require connection handling
    if (options.db) {
      console.log(`Note: Database URI provided but using in-memory store for now.`);
      console.log(`      Memgraph support requires running Memgraph instance.`);
    }

    const store = createInMemoryStore();

    // Load the bundle
    console.log(`Loading bundle: ${filePath}`);

    const startTime = Date.now();
    const result = await loadBundleToStore(store, bundle, {
      validate: false, // Already validated
      clearFirst: options.clear ?? false,
      onProgress: (progress) => {
        if (progress.phase !== 'validating') {
          process.stdout.write(`\r  ${progress.phase}: ${progress.current}/${progress.total} (${progress.percent}%)`);
        }
      },
    });
    const duration = Date.now() - startTime;

    console.log(''); // New line after progress
    console.log('');
    console.log('Load complete:');
    console.log(`  Loaded ${result.nodesLoaded} nodes`);
    console.log(`  Loaded ${result.edgesLoaded} edges`);
    console.log(`  Loaded ${result.annotationsLoaded} annotations`);
    console.log(`  Loaded ${result.patternsLoaded} patterns`);
    console.log(`  Duration: ${duration}ms`);

    if (result.errors && result.errors.length > 0) {
      console.log('');
      console.log('Warnings:');
      for (const error of result.errors) {
        console.log(`  ${error}`);
      }
    }

    // Get and display stats
    const stats = await store.getStats();
    console.log('');
    console.log('Store statistics:');
    console.log(`  Total nodes: ${stats.nodeCount}`);
    console.log(`  Total edges: ${stats.edgeCount}`);

    // Clean up
    await store.close();

    return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
