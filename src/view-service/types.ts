/**
 * View Service Types
 * Defines types and configurations for graph visualization views.
 */

import type { Node, Edge } from '../schema/types.js';
import type { EdgeKind, NodeKind } from '../constants.js';
import type { PatternMatch } from '../patterns/types.js';

/**
 * Available view types for graph projection.
 */
export type ViewType = 'call_graph' | 'inheritance' | 'module_deps' | 'full';

/**
 * All valid view types.
 */
export const VIEW_TYPES: readonly ViewType[] = [
  'call_graph',
  'inheritance',
  'module_deps',
  'full',
] as const;

/**
 * Position coordinates for layout.
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Configuration for a graph view request.
 */
export interface ViewConfig {
  /** Type of view to generate */
  view: ViewType;
  /** Root node ID for subgraph extraction (optional) */
  root_id?: string;
  /** Maximum traversal depth (default: 3) */
  depth?: number;
  /** Edge kinds to include (default: all for view type) */
  edge_kinds?: EdgeKind[];
  /** Minimum confidence threshold (default: 0.0) */
  min_confidence?: number;
  /** Node kinds to collapse (group children under parent) */
  collapse_kinds?: NodeKind[];
  /** File path patterns to exclude */
  exclude_paths?: string[];
}

/**
 * Default values for ViewConfig fields.
 */
export const VIEW_CONFIG_DEFAULTS: Required<Omit<ViewConfig, 'view' | 'root_id' | 'edge_kinds'>> & {
  edge_kinds: undefined;
} = {
  depth: 3,
  edge_kinds: undefined,
  min_confidence: 0.0,
  collapse_kinds: [],
  exclude_paths: [],
};

/**
 * Result of a view projection.
 */
export interface ProjectionResult {
  /** Nodes in the projected view */
  nodes: Node[];
  /** Edges in the projected view */
  edges: Edge[];
  /** Root node ID used for extraction (if any) */
  rootId?: string;
}

/**
 * Statistics about a view response.
 */
export interface ViewStats {
  /** Number of nodes in the view */
  nodeCount: number;
  /** Number of edges in the view */
  edgeCount: number;
  /** Time taken to compute layout in milliseconds */
  layoutTimeMs: number;
}

/**
 * Forward declaration for CytoscapeElements (defined in formatter).
 */
export interface CytoscapeElements {
  nodes: unknown[];
  edges: unknown[];
}

/**
 * Complete view response with layout.
 */
export interface ViewResponse {
  /** Cytoscape-formatted elements */
  elements: CytoscapeElements;
  /** Node positions from layout engine */
  positions: Record<string, Position>;
  /** Pattern matches (if requested) */
  patterns?: PatternMatch[];
  /** View statistics */
  stats: ViewStats;
}

/**
 * Check if a value is a valid ViewType.
 */
export function isValidViewType(value: unknown): value is ViewType {
  return typeof value === 'string' && VIEW_TYPES.includes(value as ViewType);
}

/**
 * Validate a ViewConfig object.
 * Returns true if valid, false otherwise.
 */
export function isValidViewConfig(config: unknown): config is ViewConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const obj = config as Record<string, unknown>;

  // view is required and must be valid
  if (!isValidViewType(obj.view)) {
    return false;
  }

  // root_id must be string if present
  if (obj.root_id !== undefined && typeof obj.root_id !== 'string') {
    return false;
  }

  // depth must be non-negative integer if present
  if (obj.depth !== undefined) {
    if (typeof obj.depth !== 'number' || obj.depth < 0 || !Number.isInteger(obj.depth)) {
      return false;
    }
  }

  // min_confidence must be 0-1 if present
  if (obj.min_confidence !== undefined) {
    if (typeof obj.min_confidence !== 'number' || obj.min_confidence < 0 || obj.min_confidence > 1) {
      return false;
    }
  }

  // edge_kinds must be array of strings if present
  if (obj.edge_kinds !== undefined) {
    if (!Array.isArray(obj.edge_kinds) || !obj.edge_kinds.every((k) => typeof k === 'string')) {
      return false;
    }
  }

  // collapse_kinds must be array of strings if present
  if (obj.collapse_kinds !== undefined) {
    if (!Array.isArray(obj.collapse_kinds) || !obj.collapse_kinds.every((k) => typeof k === 'string')) {
      return false;
    }
  }

  // exclude_paths must be array of strings if present
  if (obj.exclude_paths !== undefined) {
    if (!Array.isArray(obj.exclude_paths) || !obj.exclude_paths.every((p) => typeof p === 'string')) {
      return false;
    }
  }

  return true;
}

/**
 * Apply default values to a ViewConfig.
 * Returns a new config with all optional fields filled in.
 */
export function applyViewConfigDefaults(config: ViewConfig): Required<Omit<ViewConfig, 'root_id' | 'edge_kinds'>> & {
  root_id?: string;
  edge_kinds?: EdgeKind[];
} {
  return {
    view: config.view,
    root_id: config.root_id,
    depth: config.depth ?? VIEW_CONFIG_DEFAULTS.depth,
    edge_kinds: config.edge_kinds,
    min_confidence: config.min_confidence ?? VIEW_CONFIG_DEFAULTS.min_confidence,
    collapse_kinds: config.collapse_kinds ?? VIEW_CONFIG_DEFAULTS.collapse_kinds,
    exclude_paths: config.exclude_paths ?? VIEW_CONFIG_DEFAULTS.exclude_paths,
  };
}

/**
 * Validate and normalize a ViewConfig.
 * Throws an error if validation fails.
 */
export function validateViewConfig(config: unknown): ViewConfig {
  if (!isValidViewConfig(config)) {
    throw new Error('Invalid ViewConfig: must have valid view type and optional fields');
  }
  return config;
}
