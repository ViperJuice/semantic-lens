#!/usr/bin/env node
/**
 * Semantic Lens CLI
 * Command-line interface for semantic code graph operations.
 */

import { validateCommand } from './commands/validate.js';
import { loadCommand } from './commands/load.js';
import { patternsCommand } from './commands/patterns.js';
import { serveCommand } from './commands/serve.js';
import { exportCommand } from './commands/export.js';

/**
 * CLI command names.
 */
const COMMANDS = ['validate', 'load', 'patterns', 'serve', 'export'] as const;
type CommandName = (typeof COMMANDS)[number];

/**
 * Parsed CLI arguments.
 */
export interface ParsedArgs {
  command: string;
  args: string[];
  options: Record<string, string | boolean>;
  error?: boolean;
}

/**
 * Parse command-line arguments.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: '',
    args: [],
    options: {},
  };

  if (argv.length === 0) {
    result.command = 'help';
    return result;
  }

  let i = 0;

  // Check for help/version flags first
  if (argv[0] === '--help' || argv[0] === '-h') {
    result.command = 'help';
    return result;
  }

  if (argv[0] === '--version' || argv[0] === '-v') {
    result.command = 'version';
    return result;
  }

  // First non-flag argument is the command
  const firstArg = argv[0];
  if (firstArg && !firstArg.startsWith('-')) {
    result.command = firstArg;
    i = 1;
  }

  // Check if command is valid
  if (!COMMANDS.includes(result.command as CommandName) &&
      result.command !== 'help' &&
      result.command !== 'version') {
    result.error = true;
    return result;
  }

  // Parse remaining arguments
  while (i < argv.length) {
    const arg = argv[i];
    if (!arg) {
      i++;
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];

      // Check if next arg is a value or another flag
      if (nextArg && !nextArg.startsWith('-')) {
        result.options[key] = nextArg;
        i += 2;
      } else {
        result.options[key] = true;
        i++;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const nextArg = argv[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        result.options[key] = nextArg;
        i += 2;
      } else {
        result.options[key] = true;
        i++;
      }
    } else {
      result.args.push(arg);
      i++;
    }
  }

  return result;
}

/**
 * Show help text.
 */
export function showHelp(): string {
  return `
semantic-lens - Semantic Code Graph Visualization Platform

USAGE:
  semantic-lens <command> [options]

COMMANDS:
  validate <bundle.json>      Validate a SemanticGraphBundle JSON file
  load <bundle.json>          Load a bundle into graph store
  patterns                    Run pattern detection on loaded graph
  serve                       Start the view service HTTP server
  export <config.json>        Export a view to static format

OPTIONS:
  validate:
    (no options)

  load:
    --db <uri>                Graph database URI (default: in-memory)
    --clear                   Clear store before loading

  patterns:
    --bundle <file>           Bundle file to load first
    --output <file>           Output file (default: stdout)
    --pattern <id>            Filter by pattern ID

  serve:
    --port <port>             Server port (default: 3001, env: VIEW_SERVICE_PORT)
    --bundle <file>           Pre-load a bundle file

  export:
    --format <fmt>            Output format: json|png|svg (default: json)
    --output <file>           Output file (default: stdout)

GLOBAL OPTIONS:
  --help, -h                  Show this help message
  --version, -v               Show version

EXAMPLES:
  semantic-lens validate fixtures/bundle.json
  semantic-lens load bundle.json --clear
  semantic-lens patterns --bundle bundle.json --output results.json
  semantic-lens serve --port 3001 --bundle bundle.json
  semantic-lens export view-config.json --format json --output view.json
`.trim();
}

/**
 * Show version.
 */
export function showVersion(): string {
  return '0.1.0';
}

/**
 * Main CLI entry point.
 */
export async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.command === 'help') {
    console.log(showHelp());
    return 0;
  }

  if (parsed.command === 'version') {
    console.log(showVersion());
    return 0;
  }

  if (parsed.error) {
    console.error(`Unknown command: ${parsed.command}`);
    console.error('Run "semantic-lens --help" for usage information.');
    return 1;
  }

  try {
    switch (parsed.command) {
      case 'validate': {
        const filePath = parsed.args[0];
        if (!filePath) {
          console.error('Error: validate requires a file path');
          return 1;
        }
        return await validateCommand(filePath);
      }

      case 'load': {
        const filePath = parsed.args[0];
        if (!filePath) {
          console.error('Error: load requires a file path');
          return 1;
        }
        return await loadCommand(filePath, {
          db: parsed.options.db as string | undefined,
          clear: parsed.options.clear === true,
        });
      }

      case 'patterns': {
        return await patternsCommand({
          bundle: parsed.options.bundle as string | undefined,
          output: parsed.options.output as string | undefined,
          pattern: parsed.options.pattern as string | undefined,
        });
      }

      case 'serve': {
        return await serveCommand({
          port: parsed.options.port as string | undefined,
          bundle: parsed.options.bundle as string | undefined,
        });
      }

      case 'export': {
        const configPath = parsed.args[0];
        if (!configPath) {
          console.error('Error: export requires a config file path');
          return 1;
        }
        return await exportCommand(configPath, {
          format: parsed.options.format as string | undefined,
          output: parsed.options.output as string | undefined,
        });
      }

      default:
        console.error(`Unknown command: ${parsed.command}`);
        return 1;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    return 1;
  }
}

// Run if invoked directly
if (process.argv[1]?.includes('cli/index')) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
