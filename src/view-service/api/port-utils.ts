/**
 * Port Utilities
 * Dynamic port checking and resolution for the view service.
 */

import { createServer, type Server } from 'net';

/**
 * Check if a specific port is available.
 * Binds to localhost (127.0.0.1) temporarily to test availability.
 *
 * @param port - Port number to check
 * @returns Promise resolving to true if available, false if in use
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  // Validate port range
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${port}. Port must be between 1 and 65535.`);
  }

  return new Promise((resolve) => {
    const server: Server = createServer();

    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      server.close();
      resolve(false);
    }, 1000);

    server.once('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        // Other errors (e.g., permission denied) also mean unavailable
        resolve(false);
      }
    });

    server.once('listening', () => {
      clearTimeout(timeout);
      server.close(() => {
        resolve(true);
      });
    });

    // Bind to localhost only for security
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find the next available port starting from a given port.
 * Scans sequentially until an available port is found.
 *
 * @param startPort - Port to start scanning from
 * @param maxAttempts - Maximum number of ports to try (default: 100)
 * @returns Promise resolving to first available port found
 * @throws Error if no available port found in range
 */
export async function findAvailablePort(
  startPort: number,
  maxAttempts: number = 100
): Promise<number> {
  if (maxAttempts < 1) {
    throw new Error('maxAttempts must be at least 1');
  }

  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;

    // Skip if port exceeds valid range
    if (port > 65535) {
      break;
    }

    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(
    `No available port found in range ${startPort}-${startPort + maxAttempts - 1}. ` +
      `All ports appear to be in use.`
  );
}

/**
 * Get port from environment variable with validation.
 * Falls back to default if env var is not set or invalid.
 *
 * @param defaultPort - Default port if env var not set or invalid
 * @returns Port number from VIEW_SERVICE_PORT env var or default
 */
export function getPortFromEnv(defaultPort: number): number {
  const envPort = process.env.VIEW_SERVICE_PORT;

  if (!envPort) {
    return defaultPort;
  }

  const parsed = parseInt(envPort, 10);

  // Validate parsed port
  if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
    console.warn(
      `Invalid VIEW_SERVICE_PORT="${envPort}". ` +
        `Port must be between 1 and 65535. ` +
        `Using default port ${defaultPort}.`
    );
    return defaultPort;
  }

  return parsed;
}

/**
 * Resolve port with intelligent fallback logic.
 * Handles priority: explicit request > environment > default.
 *
 * @param requestedPort - Port explicitly requested (undefined for default)
 * @param allowFallback - Whether to fallback to next port if unavailable
 * @returns Promise with resolved port and metadata
 * @throws Error if explicit port unavailable and fallback not allowed
 */
export async function resolvePort(
  requestedPort: number | undefined,
  allowFallback: boolean = true
): Promise<{
  port: number;
  wasExplicit: boolean;
  didFallback: boolean;
}> {
  const DEFAULT_PORT = 3001;
  const targetPort = requestedPort !== undefined ? requestedPort : DEFAULT_PORT;
  const wasExplicit = requestedPort !== undefined;

  // Check if target port is available
  const available = await isPortAvailable(targetPort);

  if (available) {
    return {
      port: targetPort,
      wasExplicit,
      didFallback: false,
    };
  }

  // Port unavailable - decide whether to fallback or error
  if (!allowFallback) {
    const portSource = wasExplicit ? 'explicitly requested' : 'default';
    throw new Error(
      `Port ${targetPort} is already in use. ` +
        `This port was ${portSource}. ` +
        `\n\n` +
        `To use a different port:\n` +
        `  - Use --port flag: semantic-lens serve --port <number>\n` +
        `  - Set environment variable: VIEW_SERVICE_PORT=<number>\n` +
        `\n` +
        `To see what's using port ${targetPort}:\n` +
        `  - macOS/Linux: lsof -i :${targetPort}\n` +
        `  - Windows: netstat -ano | findstr :${targetPort}`
    );
  }

  // Fallback: find next available port
  try {
    const fallbackPort = await findAvailablePort(targetPort + 1, 99);
    return {
      port: fallbackPort,
      wasExplicit,
      didFallback: true,
    };
  } catch (err) {
    throw new Error(
      `Could not find an available port in range ${targetPort + 1}-${targetPort + 100}. ` +
        `All ports appear to be in use. ` +
        `\n\n` +
        `Please specify a port manually:\n` +
        `  semantic-lens serve --port <number>\n` +
        `\n` +
        `Or set environment variable:\n` +
        `  VIEW_SERVICE_PORT=<number> semantic-lens serve`
    );
  }
}
