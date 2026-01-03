/**
 * Serve Command
 * Starts the view service HTTP server.
 */

import { readFile } from 'fs/promises';
import { validateBundle } from '../../schema/validator.js';
import { createInMemoryStore } from '../../graph/memory-store.js';
import { loadBundleToStore } from '../../graph/loader.js';
import { createPatternMatcher } from '../../patterns/matcher/matcher.js';
import { parsePatternDefinition } from '../../patterns/dsl/parser.js';
import { createViewServer, type ViewServiceOptions } from '../../view-service/api/server.js';
import { resolvePort, getPortFromEnv } from '../../view-service/api/port-utils.js';
import type { GraphStore } from '../../graph/store.js';
import type { PatternMatcherInterface } from '../../patterns/matcher/matcher.js';
import type { SemanticGraphBundle } from '../../schema/types.js';

/**
 * Options for the serve command.
 */
export interface ServeCommandOptions {
  /** Server port (default: 3001, or VIEW_SERVICE_PORT env var) */
  port?: string;
  /** Bundle file to pre-load */
  bundle?: string;
}

/**
 * Server context with store and matcher.
 */
export interface ServerContext {
  port: number;
  store: GraphStore;
  matcher: PatternMatcherInterface;
}

/**
 * Built-in pattern YAML definitions.
 */
const BUILTIN_PATTERNS = [
  `
id: observer
description: Observer pattern
roles:
  subject:
    kind: class
  observer:
    kind: interface
constraints:
  - type: edge
    from: subject
    to: observer
    kind: uses
scoring:
  base: 0.6
  weights:
    subject_uses_observer: 0.4
`,
  `
id: factory
description: Factory pattern
roles:
  factory:
    kind: class
  product:
    kind: class
constraints:
  - type: edge
    from: factory
    to: product
    kind: calls
scoring:
  base: 0.5
  weights:
    factory_calls_product: 0.5
`,
];

/**
 * Create server context with store and matcher.
 */
export async function createServerContext(options: ServeCommandOptions): Promise<ServerContext> {
  // Parse CLI port
  let requestedPort: number | undefined;
  if (options.port) {
    requestedPort = parseInt(options.port, 10);
    if (isNaN(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
      throw new Error(`Invalid port: ${options.port}. Port must be between 1 and 65535.`);
    }
  }

  // Check environment
  const envPort = getPortFromEnv(3001);

  // Determine if explicitly set
  const portToResolve = requestedPort ?? envPort;
  const wasExplicitlySet =
    requestedPort !== undefined ||
    process.env.VIEW_SERVICE_PORT !== undefined;

  // Resolve with fallback control
  const { port, didFallback } = await resolvePort(
    portToResolve,
    !wasExplicitlySet  // Only fallback for defaults
  );

  // Log fallback
  if (didFallback) {
    console.log(`⚠️  Default port ${portToResolve} unavailable, using port ${port}`);
  }

  const store = createInMemoryStore();
  const matcher = createPatternMatcher();

  // Load built-in patterns
  for (const yaml of BUILTIN_PATTERNS) {
    try {
      const pattern = parsePatternDefinition(yaml);
      matcher.loadDefinitions([pattern]);
    } catch (error) {
      // Ignore parse errors for built-in patterns
    }
  }

  return { port, store, matcher };
}

/**
 * Run the serve command.
 * @param options - Command options
 * @returns Exit code (0 = success, 1 = error)
 */
export async function serveCommand(options: ServeCommandOptions): Promise<number> {
  try {
    const context = await createServerContext(options);
    const { port, store, matcher } = context;

    // Pre-load bundle if specified
    if (options.bundle) {
      console.log(`Loading bundle: ${options.bundle}`);

      let content: string;
      try {
        content = await readFile(options.bundle, 'utf-8');
      } catch (error) {
        console.error(`Failed to read bundle: ${options.bundle}`);
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
      }

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
      const result = await loadBundleToStore(store, bundle, { validate: false });
      console.log(`Loaded ${result.nodesLoaded} nodes, ${result.edgesLoaded} edges`);
    }

    // Create and start server
    const serverOptions: ViewServiceOptions = {
      port,
      store,
      matcher,
    };

    const server = createViewServer(serverOptions);

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      await server.stop();
      await store.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start server
    await server.start();

    console.log('');
    console.log('View service is running.');
    console.log('Press Ctrl+C to stop.');
    console.log('');
    console.log('Endpoints:');
    console.log(`  GET  http://localhost:${port}/health`);
    console.log(`  GET  http://localhost:${port}/views`);
    console.log(`  POST http://localhost:${port}/view`);
    console.log(`  POST http://localhost:${port}/layout/elk`);
    console.log(`  POST http://localhost:${port}/patterns/run`);

    // Keep process running
    await new Promise(() => {});

    return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
