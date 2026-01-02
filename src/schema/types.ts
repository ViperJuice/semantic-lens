/**
 * TypeScript types matching the SemanticGraphBundle JSON Schema.
 * These types are the source of truth for all graph data structures.
 */

import type { NodeKind, EdgeKind, Visibility, Evidence } from '../constants.js';

/**
 * Character offset span as [start, end].
 * Represents the position of a code element in its source file.
 */
export type Span = [start: number, end: number];

/**
 * Repository metadata for the analyzed codebase.
 */
export interface Repo {
  /** Repository URL */
  url: string;
  /** Git commit hash (at least 7 characters) */
  commit: string;
  /** Git branch name */
  branch?: string;
}

/**
 * A node in the semantic graph representing a code element.
 */
export interface Node {
  /** Unique identifier for the node (at least 8 characters) */
  node_id: string;
  /** The kind of code element this node represents */
  kind: NodeKind;
  /** Name of the code element */
  name: string;
  /** Programming language of the code element */
  language: string;
  /** File path where the element is defined */
  file: string;
  /** Character offset span [start, end] */
  span: Span;
  /** Parent node ID for nested elements */
  parent?: string;
  /** Fully qualified path to the element */
  route?: string;
  /** Access visibility of the element */
  visibility?: Visibility;
  /** Type signature for functions/methods */
  signature?: string;
  /** Hash of documentation content for change detection */
  doc_hash?: string;
}

/**
 * An edge in the semantic graph representing a relationship between nodes.
 */
export interface Edge {
  /** Unique identifier for the edge (at least 8 characters) */
  edge_id: string;
  /** The kind of relationship this edge represents */
  kind: EdgeKind;
  /** Source node ID */
  src: string;
  /** Destination node ID */
  dst: string;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Sources of evidence for this relationship (at least 1) */
  evidence: Evidence[];
  /** Additional metadata for the edge */
  meta?: Record<string, unknown>;
}

/**
 * An annotation attached to a node.
 */
export interface Annotation {
  /** ID of the node this annotation targets */
  target_id: string;
  /** List of tags for this annotation */
  tags: string[];
  /** Key-value pairs for additional annotation data */
  kv?: Record<string, string | number | boolean | null>;
}

/**
 * A detected pattern instance in the codebase.
 */
export interface PatternInstance {
  /** Unique identifier for this pattern instance */
  instance_id: string;
  /** Identifier of the pattern template */
  pattern_id: string;
  /** Mapping of role names to node IDs */
  roles: Record<string, string>;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Evidence descriptions for this pattern match */
  evidence: string[];
  /** Human-readable explanation of the pattern match */
  explain?: string;
}

/**
 * The top-level semantic graph bundle structure.
 * Contains all nodes, edges, annotations, and patterns from code analysis.
 */
export interface SemanticGraphBundle {
  /** Schema version in format vN.N (e.g., "v1.0") */
  version: string;
  /** ISO 8601 timestamp when the bundle was generated */
  generated_at: string;
  /** Repository metadata */
  repo?: Repo;
  /** All nodes in the semantic graph */
  nodes: Node[];
  /** All edges connecting nodes in the graph */
  edges: Edge[];
  /** Annotations attached to nodes */
  annotations: Annotation[];
  /** Detected pattern instances in the codebase */
  patterns: PatternInstance[];
}
