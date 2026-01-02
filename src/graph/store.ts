/**
 * GraphStore interface and associated types.
 * Defines the abstract interface for graph storage operations.
 */

import type {
  Node,
  Edge,
  Annotation,
  PatternInstance,
  SemanticGraphBundle,
} from '../schema/types.js';
import type { NodeKind, EdgeKind, Visibility, Evidence } from '../constants.js';

/**
 * Direction for edge traversal.
 */
export type Direction = 'in' | 'out' | 'both';

/**
 * Criteria for querying nodes.
 * All fields are optional; multiple fields are AND-ed.
 */
export interface NodeQuery {
  /** Filter by node kind(s) */
  kind?: NodeKind | NodeKind[];
  /** Filter by file path (exact match) */
  file?: string;
  /** Filter by route (exact match or pattern) */
  route?: string | RegExp;
  /** Filter by visibility */
  visibility?: Visibility;
  /** Filter by parent node ID */
  parent?: string;
  /** Filter by name (exact match or pattern) */
  name?: string | RegExp;
  /** Filter by language */
  language?: string;
}

/**
 * Criteria for querying edges.
 * All fields are optional; multiple fields are AND-ed.
 */
export interface EdgeQuery {
  /** Filter by edge kind(s) */
  kind?: EdgeKind | EdgeKind[];
  /** Filter by source node ID */
  src?: string;
  /** Filter by destination node ID */
  dst?: string;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Required evidence types (any match) */
  evidence?: Evidence[];
}

/**
 * Result of subgraph extraction.
 */
export interface SubgraphResult {
  /** All nodes in the subgraph */
  nodes: Node[];
  /** All edges within the subgraph (both endpoints must be in nodes) */
  edges: Edge[];
  /** The root node ID that was used for extraction */
  rootId: string;
}

/**
 * Graph statistics.
 */
export interface GraphStats {
  /** Total number of nodes */
  nodeCount: number;
  /** Total number of edges */
  edgeCount: number;
  /** Node counts by kind */
  nodesByKind: Partial<Record<NodeKind, number>>;
  /** Edge counts by kind */
  edgesByKind: Partial<Record<EdgeKind, number>>;
}

/**
 * Error codes for graph store operations.
 */
export type GraphStoreErrorCode =
  | 'INVALID_BUNDLE'
  | 'NODE_NOT_FOUND'
  | 'EDGE_NOT_FOUND'
  | 'DUPLICATE_NODE'
  | 'DUPLICATE_EDGE'
  | 'INVALID_REFERENCE'
  | 'CONNECTION_ERROR'
  | 'QUERY_ERROR';

/**
 * Base error class for graph store operations.
 */
export class GraphStoreError extends Error {
  public readonly code: GraphStoreErrorCode;

  constructor(
    message: string,
    code: GraphStoreErrorCode,
    cause?: Error
  ) {
    super(message, { cause });
    this.name = 'GraphStoreError';
    this.code = code;
  }
}

/**
 * Abstract interface for graph storage operations.
 * Implementations must be async-safe and handle concurrent access.
 */
export interface GraphStore {
  // === Write Operations ===

  /**
   * Load an entire bundle into the store.
   * Validates bundle before loading if not already validated.
   * @throws GraphStoreError if bundle is invalid or loading fails
   */
  loadBundle(bundle: SemanticGraphBundle): Promise<void>;

  /**
   * Add a single node to the store.
   * @throws GraphStoreError if node with same ID exists
   */
  addNode(node: Node): Promise<void>;

  /**
   * Add a single edge to the store.
   * @throws GraphStoreError if edge with same ID exists or src/dst nodes missing
   */
  addEdge(edge: Edge): Promise<void>;

  /**
   * Add an annotation to the store.
   * @throws GraphStoreError if target node missing
   */
  addAnnotation(annotation: Annotation): Promise<void>;

  /**
   * Add a pattern instance to the store.
   */
  addPattern(pattern: PatternInstance): Promise<void>;

  // === Read Operations ===

  /**
   * Get a node by ID.
   * @returns Node or null if not found
   */
  getNode(nodeId: string): Promise<Node | null>;

  /**
   * Get an edge by ID.
   * @returns Edge or null if not found
   */
  getEdge(edgeId: string): Promise<Edge | null>;

  /**
   * Get all edges connected to a node.
   * @param direction - 'in' for incoming, 'out' for outgoing, 'both' for all
   */
  getEdgesForNode(nodeId: string, direction?: Direction): Promise<Edge[]>;

  /**
   * Get neighboring nodes connected via edges.
   * @param direction - 'in' for incoming, 'out' for outgoing, 'both' for all
   */
  getNeighbors(nodeId: string, direction: Direction): Promise<Node[]>;

  /**
   * Get annotations for a node.
   */
  getAnnotations(nodeId: string): Promise<Annotation[]>;

  /**
   * Get all patterns involving a node.
   */
  getPatternsForNode(nodeId: string): Promise<PatternInstance[]>;

  // === Query Operations ===

  /**
   * Find nodes matching criteria.
   * All criteria are AND-ed together.
   */
  findNodes(criteria: NodeQuery): Promise<Node[]>;

  /**
   * Find edges matching criteria.
   * All criteria are AND-ed together.
   */
  findEdges(criteria: EdgeQuery): Promise<Edge[]>;

  /**
   * Extract a subgraph rooted at a node.
   * @param rootId - Starting node
   * @param depth - Maximum traversal depth (0 = root only)
   * @param edgeKinds - Optional filter for edge kinds to follow
   */
  getSubgraph(
    rootId: string,
    depth: number,
    edgeKinds?: EdgeKind[]
  ): Promise<SubgraphResult>;

  // === Lifecycle ===

  /**
   * Clear all data from the store.
   */
  clear(): Promise<void>;

  /**
   * Close connections and release resources.
   */
  close(): Promise<void>;

  /**
   * Get store statistics.
   */
  getStats(): Promise<GraphStats>;
}
