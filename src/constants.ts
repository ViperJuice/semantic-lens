/**
 * Shared constants for the Semantic Lens system.
 * These constants define the valid kinds, visibility levels, and evidence types
 * used throughout the semantic graph bundle schema.
 */

/**
 * Valid node kinds in the semantic graph.
 * Represents the structural elements that can be analyzed.
 */
export const NODE_KINDS = Object.freeze([
  'module',
  'class',
  'interface',
  'trait',
  'function',
  'method',
  'field',
  'property',
] as const);

/**
 * Type derived from NODE_KINDS for type-safe node kind references.
 */
export type NodeKind = (typeof NODE_KINDS)[number];

/**
 * Valid edge kinds representing relationships between nodes.
 * Defines the semantic connections in the code graph.
 */
export const EDGE_KINDS = Object.freeze([
  'defines',
  'imports',
  'calls',
  'inherits',
  'implements',
  'uses',
  'reads',
  'writes',
  'throws',
] as const);

/**
 * Type derived from EDGE_KINDS for type-safe edge kind references.
 */
export type EdgeKind = (typeof EDGE_KINDS)[number];

/**
 * Visibility levels for nodes.
 * Indicates the access level of a code element.
 */
export const VISIBILITY = Object.freeze(['public', 'protected', 'private', 'unknown'] as const);

/**
 * Type derived from VISIBILITY for type-safe visibility references.
 */
export type Visibility = (typeof VISIBILITY)[number];

/**
 * Evidence source types.
 * Indicates how a relationship or annotation was determined.
 */
export const EVIDENCE_TYPES = Object.freeze([
  'chunker',
  'lsp',
  'static_analysis',
  'heuristic',
  'llm_score',
] as const);

/**
 * Type derived from EVIDENCE_TYPES for type-safe evidence references.
 */
export type Evidence = (typeof EVIDENCE_TYPES)[number];
