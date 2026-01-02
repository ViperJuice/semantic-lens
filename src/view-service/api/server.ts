/**
 * View Service API Server
 * HTTP REST API for view service operations.
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import type { GraphStore } from '../../graph/store.js';
import type { PatternMatcherInterface } from '../../patterns/matcher/matcher.js';
import type { Node, Edge } from '../../schema/types.js';
import {
  VIEW_TYPES,
  isValidViewConfig,
  type ViewConfig,
  type ViewResponse,
  type Position,
} from '../types.js';
import { createProjector, type GraphProjector } from '../projector/projector.js';
import { createELKLayoutEngine, type ELKLayoutEngine } from '../layout/elk-client.js';
import { createFormatter, type CytoscapeFormatter, type CytoscapeElements } from '../formatter/formatter.js';

/**
 * Options for creating the view server.
 */
export interface ViewServiceOptions {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Graph store instance */
  store: GraphStore;
  /** Pattern matcher instance */
  matcher: PatternMatcherInterface;
}

/**
 * View server instance.
 */
export interface ViewServer {
  /** Start the server */
  start(): Promise<void>;
  /** Stop the server */
  stop(): Promise<void>;
  /** Express app instance */
  app: Express;
}

/**
 * Request body for POST /view
 */
interface ViewRequest extends ViewConfig {
  include_patterns?: boolean;
}

/**
 * Request body for POST /layout/elk
 */
interface LayoutRequest {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Request body for POST /patterns/run
 */
interface PatternsRequest {
  scope?: string[];
}

/**
 * Create the view service Express application.
 */
function createApp(
  store: GraphStore,
  matcher: PatternMatcherInterface,
  projector: GraphProjector,
  layoutEngine: ELKLayoutEngine,
  formatter: CytoscapeFormatter
): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Error handler
  const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  };

  // GET /views - List available view types
  app.get('/views', (_req: Request, res: Response) => {
    res.json({ views: VIEW_TYPES });
  });

  // GET /health - Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // POST /view - Generate a view
  app.post('/view', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ViewRequest;

      if (!isValidViewConfig(body)) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Request body must be a valid ViewConfig',
        });
        return;
      }

      const startTime = Date.now();

      // Project the view
      const projection = await projector.project(store, body);

      // Compute layout
      const positions = await layoutEngine.layout(projection.nodes, projection.edges);

      // Format as Cytoscape elements
      let elements: CytoscapeElements = formatter.format(projection.nodes, projection.edges);
      elements = formatter.applyPositions(elements, positions);

      // Get patterns if requested
      let patterns;
      if (body.include_patterns) {
        const nodeIds = projection.nodes.map((n) => n.node_id);
        patterns = await matcher.match(store, nodeIds);
        elements = formatter.applyPatternOverlay(elements, patterns);
      }

      const layoutTimeMs = Date.now() - startTime;

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

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /layout/elk - Compute layout only
  app.post('/layout/elk', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LayoutRequest;

      if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Request body must have nodes and edges arrays',
        });
        return;
      }

      const positions = await layoutEngine.layout(body.nodes, body.edges);

      res.json({ positions });
    } catch (err) {
      next(err);
    }
  });

  // POST /patterns/run - Run pattern detection
  app.post('/patterns/run', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as PatternsRequest;
      const scope = body.scope;

      const patterns = await matcher.match(store, scope);

      res.json({ patterns });
    } catch (err) {
      next(err);
    }
  });

  // Apply error handler
  app.use(errorHandler);

  return app;
}

/**
 * Create a view server instance.
 * @param options - Server options
 * @returns View server with start/stop methods
 */
export function createViewServer(options: ViewServiceOptions): ViewServer {
  const { port = 3000, store, matcher } = options;

  const projector = createProjector();
  const layoutEngine = createELKLayoutEngine();
  const formatter = createFormatter();

  const app = createApp(store, matcher, projector, layoutEngine, formatter);

  let server: ReturnType<typeof app.listen> | null = null;

  return {
    app,

    async start(): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          server = app.listen(port, () => {
            console.log(`View service listening on port ${port}`);
            resolve();
          });

          server.on('error', reject);
        } catch (err) {
          reject(err);
        }
      });
    },

    async stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }

        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            server = null;
            resolve();
          }
        });
      });
    },
  };
}
