/**
 * Graph projection: filters visible nodes and edges based on ViewState.
 * This creates a "view" of the graph without modifying the underlying data.
 */

import type { ViewState } from './viewState.js';
import type { SemanticGraph, GraphNodeAttributes, GraphEdgeAttributes } from './buildGraph.js';

/**
 * Result of projecting the graph based on current view state.
 */
export interface ProjectionResult {
  /** Set of node IDs that should be visible */
  visibleNodes: Set<string>;
  /** Set of edge keys that should be visible */
  visibleEdges: Set<string>;
  /** Count statistics */
  stats: {
    totalNodes: number;
    visibleNodes: number;
    hiddenNodes: number;
    totalEdges: number;
    visibleEdges: number;
    hiddenEdges: number;
  };
}

/**
 * Projects the graph based on current view state.
 * Determines which nodes and edges should be visible.
 */
export function projectGraph(
  graph: SemanticGraph,
  state: ViewState
): ProjectionResult {
  const visibleNodes = new Set<string>();
  const visibleEdges = new Set<string>();

  let hiddenNodeCount = 0;
  let hiddenEdgeCount = 0;

  // Phase 1: Determine visible nodes
  graph.forEachNode((nodeId, attrs) => {
    // Skip deleted nodes
    if (state.deletedNodes.has(nodeId)) {
      hiddenNodeCount++;
      return;
    }

    // Skip hidden nodes
    if (state.hiddenNodes.has(nodeId)) {
      hiddenNodeCount++;
      return;
    }

    // Skip isolates if not showing them
    if (attrs.isolate && !state.showIsolates) {
      hiddenNodeCount++;
      return;
    }

    // Node is visible
    visibleNodes.add(nodeId);
  });

  // Phase 2: Determine visible edges based on edge mode
  if (state.edgeMode !== 'none') {
    graph.forEachEdge((edgeKey, attrs, src, dst) => {
      // Both endpoints must be visible
      if (!visibleNodes.has(src) || !visibleNodes.has(dst)) {
        hiddenEdgeCount++;
        return;
      }

      // Selection mode: only show edges connected to selected nodes
      if (state.edgeMode === 'selection') {
        const srcSelected = state.selectedNodes.has(src);
        const dstSelected = state.selectedNodes.has(dst);

        if (!srcSelected && !dstSelected) {
          hiddenEdgeCount++;
          return;
        }
      }

      // External edge filter: hide edges crossing cluster boundaries
      if (state.hideExternalEdges) {
        const srcCommunity = graph.getNodeAttribute(src, 'community');
        const dstCommunity = graph.getNodeAttribute(dst, 'community');

        if (srcCommunity !== undefined && dstCommunity !== undefined) {
          if (srcCommunity !== dstCommunity) {
            hiddenEdgeCount++;
            return;
          }
        }
      }

      // Edge is visible
      visibleEdges.add(edgeKey);
    });
  } else {
    // Edge mode is 'none' - hide all edges
    hiddenEdgeCount = graph.size;
  }

  return {
    visibleNodes,
    visibleEdges,
    stats: {
      totalNodes: graph.order,
      visibleNodes: visibleNodes.size,
      hiddenNodes: hiddenNodeCount,
      totalEdges: graph.size,
      visibleEdges: visibleEdges.size,
      hiddenEdges: hiddenEdgeCount,
    },
  };
}

/**
 * Applies a projection result to the graph by setting hidden attributes.
 */
export function applyProjection(
  graph: SemanticGraph,
  projection: ProjectionResult
): void {
  // Update node visibility
  graph.forEachNode((nodeId) => {
    const isHidden = !projection.visibleNodes.has(nodeId);
    graph.setNodeAttribute(nodeId, 'hidden', isHidden);
  });

  // Update edge visibility
  graph.forEachEdge((edgeKey) => {
    const isHidden = !projection.visibleEdges.has(edgeKey);
    graph.setEdgeAttribute(edgeKey, 'hidden', isHidden);
  });
}

/**
 * Gets all edges connected to a set of nodes.
 * Useful for highlighting related structure.
 */
export function getConnectedEdges(
  graph: SemanticGraph,
  nodeIds: Set<string>
): Set<string> {
  const connectedEdges = new Set<string>();

  for (const nodeId of nodeIds) {
    if (!graph.hasNode(nodeId)) continue;

    graph.forEachEdge(nodeId, (edgeKey) => {
      connectedEdges.add(edgeKey);
    });
  }

  return connectedEdges;
}

/**
 * Gets neighbor node IDs for a set of nodes.
 * depth=1 means immediate neighbors, depth=2 means neighbors of neighbors, etc.
 */
export function getNeighbors(
  graph: SemanticGraph,
  nodeIds: Set<string>,
  depth: number = 1
): Set<string> {
  let current = new Set(nodeIds);
  const all = new Set(nodeIds);

  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();

    for (const nodeId of current) {
      if (!graph.hasNode(nodeId)) continue;

      graph.forEachNeighbor(nodeId, (neighbor) => {
        if (!all.has(neighbor)) {
          next.add(neighbor);
          all.add(neighbor);
        }
      });
    }

    current = next;
    if (current.size === 0) break;
  }

  return all;
}

/**
 * Finds nodes matching a query.
 */
export interface NodeQuery {
  kind?: string;
  file?: string;
  name?: string;
  namePattern?: RegExp;
}

export function findNodes(
  graph: SemanticGraph,
  query: NodeQuery
): string[] {
  const results: string[] = [];

  graph.forEachNode((nodeId, attrs) => {
    // Kind filter
    if (query.kind && attrs.kind !== query.kind) return;

    // File filter
    if (query.file && !attrs.file.includes(query.file)) return;

    // Name filter (exact match)
    if (query.name && attrs.label !== query.name) return;

    // Name pattern filter (regex)
    if (query.namePattern && !query.namePattern.test(attrs.label)) return;

    results.push(nodeId);
  });

  return results;
}
