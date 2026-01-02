/**
 * Graph Projector
 * Extracts view-specific subgraphs from the graph store.
 */

import type { GraphStore } from '../../graph/store.js';
import type { Node, Edge } from '../../schema/types.js';
import type { EdgeKind } from '../../constants.js';
import { EDGE_KINDS } from '../../constants.js';
import type { ViewConfig, ViewType, ProjectionResult } from '../types.js';
import { applyViewConfigDefaults } from '../types.js';

/**
 * Edge kinds for each view type.
 */
const VIEW_EDGE_KINDS: Record<ViewType, EdgeKind[]> = {
  call_graph: ['calls', 'uses'],
  inheritance: ['inherits', 'implements'],
  module_deps: ['imports', 'defines'],
  full: [...EDGE_KINDS],
};

/**
 * Interface for graph projection operations.
 */
export interface GraphProjector {
  /**
   * Project a view from the graph store.
   * @param store - The graph store to project from
   * @param config - View configuration
   * @returns Projected nodes and edges
   */
  project(store: GraphStore, config: ViewConfig): Promise<ProjectionResult>;

  /**
   * Get edge kinds for a specific view type.
   * @param viewType - The view type
   * @returns Array of edge kinds for this view
   */
  getEdgeKindsForView(viewType: ViewType): EdgeKind[];
}

/**
 * Implementation of the GraphProjector interface.
 */
class GraphProjectorImpl implements GraphProjector {
  /**
   * Get edge kinds for a specific view type.
   */
  getEdgeKindsForView(viewType: ViewType): EdgeKind[] {
    return VIEW_EDGE_KINDS[viewType] || [...EDGE_KINDS];
  }

  /**
   * Project a view from the graph store.
   */
  async project(store: GraphStore, config: ViewConfig): Promise<ProjectionResult> {
    const normalizedConfig = applyViewConfigDefaults(config);
    const edgeKinds = normalizedConfig.edge_kinds || this.getEdgeKindsForView(normalizedConfig.view);

    let nodes: Node[];
    let edges: Edge[];
    let rootId: string | undefined = normalizedConfig.root_id;

    if (rootId) {
      // Extract subgraph from root node
      const subgraph = await store.getSubgraph(rootId, normalizedConfig.depth, edgeKinds);
      nodes = subgraph.nodes;
      edges = subgraph.edges;
    } else {
      // Get all nodes and filter edges
      nodes = await store.findNodes({});
      const allEdges = await store.findEdges({});
      edges = allEdges.filter((e) => edgeKinds.includes(e.kind));
    }

    // Apply confidence filtering
    if (normalizedConfig.min_confidence > 0) {
      edges = edges.filter((e) => e.confidence >= normalizedConfig.min_confidence);

      // Remove nodes that are no longer connected
      const connectedNodeIds = new Set<string>();
      for (const edge of edges) {
        connectedNodeIds.add(edge.src);
        connectedNodeIds.add(edge.dst);
      }

      // Keep root node even if not connected
      if (rootId) {
        connectedNodeIds.add(rootId);
      }

      // If no root, keep all nodes; otherwise filter
      if (rootId) {
        nodes = nodes.filter((n) => connectedNodeIds.has(n.node_id));
      }
    }

    // Apply path exclusions
    if (normalizedConfig.exclude_paths.length > 0) {
      const excludePatterns = normalizedConfig.exclude_paths.map(
        (p) => new RegExp(p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
      );

      nodes = nodes.filter((n) => {
        return !excludePatterns.some((pattern) => pattern.test(n.file));
      });

      // Filter edges to only include those between remaining nodes
      const remainingNodeIds = new Set(nodes.map((n) => n.node_id));
      edges = edges.filter((e) => remainingNodeIds.has(e.src) && remainingNodeIds.has(e.dst));
    }

    // Apply collapse semantics
    if (normalizedConfig.collapse_kinds.length > 0) {
      const collapseKinds = new Set(normalizedConfig.collapse_kinds);
      const nodesToCollapse = new Set<string>();
      const parentMap = new Map<string, string>();

      // Find nodes to collapse (those whose kind is in collapse_kinds)
      for (const node of nodes) {
        if (collapseKinds.has(node.kind) && node.parent) {
          // This node should collapse into its parent
          // Actually, collapse means children are hidden under parent
          // So we find nodes whose parent kind is in collapse_kinds
        }
      }

      // Build parent-child relationships
      for (const node of nodes) {
        if (node.parent) {
          const parent = nodes.find((n) => n.node_id === node.parent);
          if (parent && collapseKinds.has(parent.kind)) {
            nodesToCollapse.add(node.node_id);
            parentMap.set(node.node_id, parent.node_id);
          }
        }
      }

      // Remove collapsed nodes
      nodes = nodes.filter((n) => !nodesToCollapse.has(n.node_id));

      // Reroute edges
      edges = edges.map((e) => {
        const newSrc = parentMap.get(e.src) || e.src;
        const newDst = parentMap.get(e.dst) || e.dst;

        if (newSrc !== e.src || newDst !== e.dst) {
          return { ...e, src: newSrc, dst: newDst };
        }
        return e;
      });

      // Remove self-loops created by collapse
      edges = edges.filter((e) => e.src !== e.dst);

      // Remove edges to/from collapsed nodes
      const remainingNodeIds = new Set(nodes.map((n) => n.node_id));
      edges = edges.filter((e) => remainingNodeIds.has(e.src) && remainingNodeIds.has(e.dst));

      // Deduplicate edges (same src/dst/kind)
      const edgeKeys = new Set<string>();
      edges = edges.filter((e) => {
        const key = `${e.src}:${e.dst}:${e.kind}`;
        if (edgeKeys.has(key)) {
          return false;
        }
        edgeKeys.add(key);
        return true;
      });
    }

    return {
      nodes,
      edges,
      rootId,
    };
  }
}

/**
 * Create a new GraphProjector instance.
 */
export function createProjector(): GraphProjector {
  return new GraphProjectorImpl();
}
