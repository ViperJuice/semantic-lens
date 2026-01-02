/**
 * Export Command
 * Exports a view to static format (JSON, PNG, SVG).
 */

import { readFile, writeFile } from 'fs/promises';
import { validateBundle } from '../../schema/validator.js';
import { createInMemoryStore } from '../../graph/memory-store.js';
import { loadBundleToStore } from '../../graph/loader.js';
import { createPatternMatcher } from '../../patterns/matcher/matcher.js';
import { createProjector } from '../../view-service/projector/projector.js';
import { createELKLayoutEngine } from '../../view-service/layout/elk-client.js';
import { createFormatter } from '../../view-service/formatter/formatter.js';
import { isValidViewConfig, type ViewConfig, type ViewResponse } from '../../view-service/types.js';
import type { SemanticGraphBundle } from '../../schema/types.js';

/**
 * Options for the export command.
 */
export interface ExportCommandOptions {
  /** Output format (json, png, svg) */
  format?: string;
  /** Output file path */
  output?: string;
}

/**
 * Export view configuration.
 */
interface ExportConfig extends ViewConfig {
  /** Bundle file to load */
  bundle: string;
  /** Include pattern overlays */
  include_patterns?: boolean;
}

/**
 * Run the export command.
 * @param configPath - Path to the view configuration JSON
 * @param options - Command options
 * @returns Exit code (0 = success, 1 = error)
 */
export async function exportCommand(
  configPath: string,
  options: ExportCommandOptions
): Promise<number> {
  try {
    const format = options.format || 'json';

    // Validate format
    if (!['json', 'png', 'svg'].includes(format)) {
      console.error(`Invalid format: ${format}. Must be json, png, or svg`);
      return 1;
    }

    // Read config file
    let configContent: string;
    try {
      configContent = await readFile(configPath, 'utf-8');
    } catch (error) {
      console.error(`Failed to read config file: ${configPath}`);
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Parse config
    let config: ExportConfig;
    try {
      config = JSON.parse(configContent);
    } catch (error) {
      console.error(`Failed to parse config JSON: ${configPath}`);
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Validate view config
    if (!isValidViewConfig(config)) {
      console.error('Invalid view configuration');
      return 1;
    }

    // Check for bundle path
    if (!config.bundle) {
      console.error('Config must include "bundle" path');
      return 1;
    }

    // Read bundle
    let bundleContent: string;
    try {
      bundleContent = await readFile(config.bundle, 'utf-8');
    } catch (error) {
      console.error(`Failed to read bundle: ${config.bundle}`);
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Parse and validate bundle
    let bundleData: unknown;
    try {
      bundleData = JSON.parse(bundleContent);
    } catch (error) {
      console.error(`Failed to parse bundle JSON: ${config.bundle}`);
      return 1;
    }

    const validationResult = validateBundle(bundleData);
    if (!validationResult.valid) {
      console.error(`Invalid bundle: ${config.bundle}`);
      return 1;
    }

    const bundle = bundleData as SemanticGraphBundle;

    // Create store and load bundle
    const store = createInMemoryStore();
    await loadBundleToStore(store, bundle, { validate: false });

    // Create services
    const matcher = createPatternMatcher();
    const projector = createProjector();
    const layoutEngine = createELKLayoutEngine();
    const formatter = createFormatter();

    // Project the view
    const startTime = Date.now();
    const projection = await projector.project(store, config);

    // Compute layout
    const positions = await layoutEngine.layout(projection.nodes, projection.edges);

    // Format as Cytoscape elements
    let elements = formatter.format(projection.nodes, projection.edges);
    elements = formatter.applyPositions(elements, positions);

    // Get patterns if requested
    let patterns;
    if (config.include_patterns) {
      const nodeIds = projection.nodes.map((n) => n.node_id);
      patterns = await matcher.match(store, nodeIds);
      elements = formatter.applyPatternOverlay(elements, patterns);
    }

    const layoutTimeMs = Date.now() - startTime;

    // Build response
    const response: ViewResponse = {
      elements,
      positions,
      patterns,
      stats: {
        nodeCount: projection.nodes.length,
        edgeCount: projection.edges.length,
        layoutTimeMs,
      },
    };

    // Handle output based on format
    if (format === 'json') {
      const output = JSON.stringify(response, null, 2);

      if (options.output) {
        await writeFile(options.output, output, 'utf-8');
        console.log(`Exported to: ${options.output}`);
        console.log(`  Nodes: ${response.stats?.nodeCount}`);
        console.log(`  Edges: ${response.stats?.edgeCount}`);
        console.log(`  Layout time: ${response.stats?.layoutTimeMs}ms`);
      } else {
        console.log(output);
      }
    } else if (format === 'png' || format === 'svg') {
      // PNG/SVG export would require headless browser or canvas rendering
      // For now, output JSON with a note
      console.error(`Note: ${format.toUpperCase()} export requires headless rendering.`);
      console.error('For now, use --format json and render client-side.');

      // Still output JSON for programmatic use
      if (options.output) {
        const output = JSON.stringify(response, null, 2);
        const jsonOutput = options.output.replace(/\.(png|svg)$/, '.json');
        await writeFile(jsonOutput, output, 'utf-8');
        console.log(`JSON exported to: ${jsonOutput}`);
      }
    }

    // Clean up
    await store.close();

    return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
