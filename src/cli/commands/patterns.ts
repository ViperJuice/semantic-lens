/**
 * Patterns Command
 * Runs pattern detection on a loaded graph.
 */

import { readFile, writeFile } from 'fs/promises';
import { validateBundle } from '../../schema/validator.js';
import { createInMemoryStore } from '../../graph/memory-store.js';
import { loadBundleToStore } from '../../graph/loader.js';
import { createPatternMatcher } from '../../patterns/matcher/matcher.js';
import { parsePatternDefinition } from '../../patterns/dsl/parser.js';
import type { SemanticGraphBundle } from '../../schema/types.js';
import type { PatternDefinition, PatternMatch } from '../../patterns/types.js';

/**
 * Options for the patterns command.
 */
export interface PatternsCommandOptions {
  /** Bundle file to load */
  bundle?: string;
  /** Output file (default: stdout) */
  output?: string;
  /** Filter by pattern ID */
  pattern?: string;
}

/**
 * Built-in pattern definitions (embedded YAML).
 */
const BUILTIN_PATTERNS: string[] = [
  `
id: observer
description: Observer pattern - subject notifies observers of changes
roles:
  subject:
    kind: class
    name: /Subject|Observable|Publisher/
  observer:
    kind: interface
    name: /Observer|Listener|Subscriber/
  notify_method:
    kind: method
    owned_by: subject
    name: /notify|publish|emit|fire/
constraints:
  - type: edge
    from: subject
    to: observer
    kind: uses
  - type: group
    role: observer
    min_size: 1
scoring:
  base: 0.6
  weights:
    subject_uses_observer: 0.2
    group_observer: 0.2
`,
  `
id: factory
description: Factory pattern - creates objects without specifying exact class
roles:
  factory:
    kind: class
    name: /Factory|Creator|Builder/
  create_method:
    kind: method
    owned_by: factory
    name: /create|make|build|new/
  product:
    kind: class
constraints:
  - type: edge
    from: create_method
    to: product
    kind: calls
scoring:
  base: 0.5
  weights:
    create_method_calls_product: 0.3
    multiple_products: 0.2
`,
  `
id: singleton
description: Singleton pattern - ensures single instance
roles:
  singleton:
    kind: class
    name: /Singleton|Instance|Manager/
  get_instance:
    kind: method
    owned_by: singleton
    name: /getInstance|instance|shared|default/
  instance_field:
    kind: field
    owned_by: singleton
constraints:
  - type: edge
    from: get_instance
    to: instance_field
    kind: reads
scoring:
  base: 0.6
  weights:
    get_instance_reads_instance_field: 0.4
`,
  `
id: strategy
description: Strategy pattern - encapsulates algorithms
roles:
  strategy:
    kind: interface
    name: /Strategy|Algorithm|Policy/
  context:
    kind: class
  execute_method:
    kind: method
    owned_by: strategy
constraints:
  - type: edge
    from: context
    to: strategy
    kind: uses
  - type: group
    role: strategy
    min_size: 1
scoring:
  base: 0.5
  weights:
    context_uses_strategy: 0.3
    group_strategy: 0.2
`,
];

/**
 * Load built-in pattern definitions.
 */
function loadBuiltinPatterns(): PatternDefinition[] {
  const patterns: PatternDefinition[] = [];

  for (const yaml of BUILTIN_PATTERNS) {
    try {
      const pattern = parsePatternDefinition(yaml);
      patterns.push(pattern);
    } catch (error) {
      console.error(`Failed to parse built-in pattern: ${error}`);
    }
  }

  return patterns;
}

/**
 * Run the patterns command.
 * @param options - Command options
 * @returns Exit code (0 = success, 1 = error)
 */
export async function patternsCommand(options: PatternsCommandOptions): Promise<number> {
  try {
    // Check for bundle
    if (!options.bundle) {
      console.error('Error: --bundle <file> is required');
      console.error('Usage: semantic-lens patterns --bundle <file> [--output <file>] [--pattern <id>]');
      return 1;
    }

    // Read the bundle
    let content: string;
    try {
      content = await readFile(options.bundle, 'utf-8');
    } catch (error) {
      console.error(`Failed to read bundle: ${options.bundle}`);
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Parse and validate
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to parse JSON: ${options.bundle}`);
      return 1;
    }

    const validationResult = validateBundle(data);
    if (!validationResult.valid) {
      console.error(`Invalid bundle: ${options.bundle}`);
      return 1;
    }

    const bundle = data as SemanticGraphBundle;

    // Create store and load bundle
    const store = createInMemoryStore();
    await loadBundleToStore(store, bundle, { validate: false });

    // Create pattern matcher
    const matcher = createPatternMatcher();

    // Load patterns
    const patterns = loadBuiltinPatterns();
    matcher.loadDefinitions(patterns);

    // Run pattern matching
    let matches: PatternMatch[];
    if (options.pattern) {
      matches = await matcher.matchPattern(store, options.pattern);
    } else {
      matches = await matcher.match(store);
    }

    // Format output
    const output = JSON.stringify(
      {
        bundle: options.bundle,
        patternCount: patterns.length,
        matchCount: matches.length,
        matches,
      },
      null,
      2
    );

    // Write output
    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(`Results written to: ${options.output}`);
      console.log(`Found ${matches.length} pattern match(es)`);
    } else {
      console.log(output);
    }

    // Clean up
    await store.close();

    return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
