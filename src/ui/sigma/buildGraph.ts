/**
 * Converts a SemanticGraphBundle into a Graphology graph for Sigma.js rendering.
 */

import Graph, { MultiDirectedGraph } from 'graphology';
import type { AbstractGraph, Attributes } from 'graphology-types';
import type { SemanticGraphBundle, Edge } from '../../schema/types.js';
import type { NodeKind } from '../../constants.js';

/** Type alias for a Graphology graph with our attributes */
export type SemanticGraph = AbstractGraph<GraphNodeAttributes, GraphEdgeAttributes>;

/**
 * Color palette for node kinds (dark theme friendly).
 * Colors chosen for contrast against #1a1a2e background.
 */
export const KIND_COLORS: Record<NodeKind, string> = {
  module: '#9b59b6', // Purple
  class: '#3498db', // Blue
  interface: '#e67e22', // Orange
  trait: '#e74c3c', // Red
  function: '#2ecc71', // Green
  method: '#00bcd4', // Cyan
  field: '#f1c40f', // Yellow
  property: '#95a5a6', // Gray
};

/**
 * Node attributes stored in the Graphology graph.
 */
export interface GraphNodeAttributes {
  label: string;
  kind: NodeKind;
  file: string;
  parent?: string;
  route?: string;
  color: string;
  size: number;
  x: number;
  y: number;
  isolate?: boolean;
  community?: number;
  hidden?: boolean;
}

/**
 * Edge attributes stored in the Graphology graph.
 */
export interface GraphEdgeAttributes {
  id: string;
  kind: string;
  confidence: number;
  synthetic: boolean;
  hidden?: boolean;
}

export interface BuildGraphOptions {
  bundle: SemanticGraphBundle;
  /** Nodes with degree <= this value are considered isolates. Default: 0 */
  isolateThreshold?: number;
  /** Base node size. Default: 5 */
  baseNodeSize?: number;
}

export interface BuildGraphResult {
  graph: SemanticGraph;
  isolates: Set<string>;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Determines if an edge is synthetic (inferred rather than directly observed).
 */
function isSyntheticEdge(edge: Edge): boolean {
  if (edge.confidence < 1.0) {
    return true;
  }
  if (edge.evidence) {
    return edge.evidence.some((e) => e === 'heuristic' || e === 'llm_score');
  }
  return false;
}

/**
 * Builds a Graphology graph from a SemanticGraphBundle.
 * Also identifies isolate nodes (nodes with no connections).
 */
export function buildGraph(options: BuildGraphOptions): BuildGraphResult {
  const { bundle, isolateThreshold = 0, baseNodeSize = 5 } = options;

  const graph: SemanticGraph = new MultiDirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();

  // Track which node_ids exist for edge validation
  const nodeIds = new Set<string>();

  // Add nodes with random initial positions
  for (const node of bundle.nodes) {
    // Skip duplicate nodes
    if (nodeIds.has(node.node_id)) {
      continue;
    }
    nodeIds.add(node.node_id);

    const attrs: GraphNodeAttributes = {
      label: node.name,
      kind: node.kind,
      file: node.file,
      parent: node.parent,
      route: node.route,
      color: KIND_COLORS[node.kind] ?? '#666666',
      size: baseNodeSize,
      // Random initial positions (will be overwritten by layout)
      x: Math.random() * 1000,
      y: Math.random() * 1000,
    };

    graph.addNode(node.node_id, attrs);
  }

  // Add edges (skip edges with missing endpoints)
  let skippedEdges = 0;
  for (const edge of bundle.edges) {
    if (!nodeIds.has(edge.src) || !nodeIds.has(edge.dst)) {
      skippedEdges++;
      continue;
    }

    const attrs: GraphEdgeAttributes = {
      id: edge.edge_id,
      kind: edge.kind,
      confidence: edge.confidence ?? 1.0,
      synthetic: isSyntheticEdge(edge),
    };

    graph.addEdge(edge.src, edge.dst, attrs);
  }

  if (skippedEdges > 0) {
    console.warn(`Skipped ${skippedEdges} edges with missing endpoints`);
  }

  // Identify isolates (nodes with degree <= threshold)
  const isolates = new Set<string>();
  graph.forEachNode((nodeId) => {
    const degree = graph.degree(nodeId);
    if (degree <= isolateThreshold) {
      isolates.add(nodeId);
      graph.setNodeAttribute(nodeId, 'isolate', true);
    }
  });

  return {
    graph,
    isolates,
    nodeCount: graph.order,
    edgeCount: graph.size,
  };
}

/**
 * Gets a short label for a node (last part of name or first N chars).
 */
export function getShortLabel(label: string, maxLength: number = 12): string {
  // If it contains dots, take the last part
  if (label.includes('.')) {
    const parts = label.split('.');
    label = parts[parts.length - 1] ?? label;
  }
  // Truncate if still too long
  if (label.length > maxLength) {
    return label.slice(0, maxLength - 1) + '…';
  }
  return label;
}
