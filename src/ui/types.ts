/**
 * UI Types
 * Defines types and interfaces for the visualization UI layer.
 */

import type { EdgeKind, NodeKind } from '../constants.js';
import type { CytoscapeElements, CytoscapeNode, CytoscapeEdge } from '../view-service/formatter/formatter.js';
import type { Position } from '../view-service/types.js';
import type { PatternMatch } from '../patterns/types.js';

/**
 * Props for the GraphView component.
 */
export interface GraphViewProps {
  /** Cytoscape elements to render */
  elements: CytoscapeElements;
  /** Node positions from layout engine */
  positions: Record<string, Position>;
  /** Pattern matches to overlay (optional) */
  patterns?: PatternMatch[];
  /** Callback when a node is clicked */
  onNodeClick?: (nodeId: string, node: CytoscapeNode) => void;
  /** Callback when a node is double-clicked for expansion */
  onNodeExpand?: (nodeId: string) => void;
  /** Callback when a node is collapsed */
  onNodeCollapse?: (nodeId: string) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (edgeId: string) => void;
  /** Whether to enable user zoom/pan (default: true) */
  interactive?: boolean;
  /** Container element ID or ref */
  container?: string | HTMLElement;
}

/**
 * Lens configuration for filtering displayed elements.
 */
export interface LensConfig {
  /** Edge kinds to display */
  edgeKinds: EdgeKind[];
  /** Minimum confidence threshold (0-1) */
  minConfidence: number;
  /** Whether to show pattern overlays */
  showPatterns: boolean;
  /** Specific pattern IDs to show (empty = all) */
  patternFilter?: string[];
  /** Node kinds to show (empty = all) */
  nodeKinds?: NodeKind[];
}

/**
 * Default lens configuration.
 */
export const DEFAULT_LENS_CONFIG: LensConfig = {
  edgeKinds: ['calls', 'inherits', 'implements', 'defines', 'imports', 'uses', 'reads', 'writes', 'throws'],
  minConfidence: 0.0,
  showPatterns: true,
  patternFilter: [],
  nodeKinds: [],
};

/**
 * Interface for controlling the graph view.
 */
export interface GraphControls {
  /** Apply a lens configuration to filter elements */
  setLens(config: LensConfig): void;
  /** Get the current lens configuration */
  getLens(): LensConfig;
  /** Expand a collapsed node to show its children */
  expandNode(nodeId: string): Promise<void>;
  /** Collapse a node to hide its children */
  collapseNode(nodeId: string): void;
  /** Highlight nodes in a specific pattern */
  highlightPattern(instanceId: string): void;
  /** Clear pattern highlighting */
  clearHighlight(): void;
  /** Fit the graph to the viewport */
  fitToView(): void;
  /** Center on a specific node */
  centerOnNode(nodeId: string): void;
  /** Export the current view as a PNG blob */
  exportPNG(): Promise<Blob>;
  /** Export the current view as SVG string */
  exportSVG(): string;
  /** Get the current zoom level */
  getZoom(): number;
  /** Set the zoom level */
  setZoom(level: number): void;
  /** Get the set of expanded node IDs */
  getExpandedNodes(): Set<string>;
  /** Get the set of collapsed node IDs */
  getCollapsedNodes(): Set<string>;
}

/**
 * Props for the LensPanel component.
 */
export interface LensPanelProps {
  /** Current lens configuration */
  config: LensConfig;
  /** Callback when lens configuration changes */
  onChange: (config: LensConfig) => void;
  /** Available edge kinds to toggle */
  availableEdgeKinds: EdgeKind[];
  /** Available node kinds to toggle */
  availableNodeKinds: NodeKind[];
}

/**
 * Props for the PatternPanel component.
 */
export interface PatternPanelProps {
  /** Pattern matches to display */
  patterns: PatternMatch[];
  /** Currently highlighted pattern instance ID */
  highlightedPattern?: string;
  /** Callback when a pattern is selected */
  onPatternSelect: (instanceId: string) => void;
  /** Callback when highlighting is cleared */
  onClearHighlight: () => void;
  /** Whether to group patterns by pattern ID */
  groupByPattern?: boolean;
}

/**
 * Pattern overlay configuration.
 */
export interface PatternOverlayConfig {
  /** Pattern matches to visualize */
  patterns: PatternMatch[];
  /** Style for convex hulls */
  hullStyle?: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
  };
  /** Whether to show labels on hulls */
  showLabels?: boolean;
  /** Highlighted pattern instance ID */
  highlightedInstance?: string;
}

/**
 * Validate LensConfig.
 * @param config - The config to validate
 * @returns True if the config is valid
 */
export function isValidLensConfig(config: unknown): config is LensConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const obj = config as Record<string, unknown>;

  // edgeKinds must be an array of strings
  if (!Array.isArray(obj.edgeKinds)) {
    return false;
  }
  if (!obj.edgeKinds.every((k) => typeof k === 'string')) {
    return false;
  }

  // minConfidence must be a number between 0 and 1
  if (typeof obj.minConfidence !== 'number') {
    return false;
  }
  if (obj.minConfidence < 0 || obj.minConfidence > 1) {
    return false;
  }

  // showPatterns must be a boolean
  if (typeof obj.showPatterns !== 'boolean') {
    return false;
  }

  // patternFilter is optional but must be an array of strings if present
  if (obj.patternFilter !== undefined) {
    if (!Array.isArray(obj.patternFilter)) {
      return false;
    }
    if (!obj.patternFilter.every((p) => typeof p === 'string')) {
      return false;
    }
  }

  // nodeKinds is optional but must be an array of strings if present
  if (obj.nodeKinds !== undefined) {
    if (!Array.isArray(obj.nodeKinds)) {
      return false;
    }
    if (!obj.nodeKinds.every((k) => typeof k === 'string')) {
      return false;
    }
  }

  return true;
}

/**
 * Apply lens filter to elements.
 * Filters nodes and edges based on the lens configuration.
 * @param elements - The elements to filter
 * @param config - The lens configuration to apply
 * @returns Filtered elements
 */
export function applyLensFilter(
  elements: CytoscapeElements,
  config: LensConfig
): CytoscapeElements {
  // Filter nodes by kind if nodeKinds is specified and not empty
  let filteredNodes = elements.nodes;
  if (config.nodeKinds && config.nodeKinds.length > 0) {
    const allowedNodeKinds = new Set(config.nodeKinds);
    filteredNodes = elements.nodes.filter((node) =>
      allowedNodeKinds.has(node.data.kind)
    );
  }

  // Build a set of remaining node IDs for edge filtering
  const remainingNodeIds = new Set(filteredNodes.map((n) => n.data.id));

  // Filter edges by:
  // 1. Edge kind must be in edgeKinds
  // 2. Confidence must be >= minConfidence
  // 3. Source and target must be in remaining nodes
  const allowedEdgeKinds = new Set(config.edgeKinds);
  const filteredEdges = elements.edges.filter((edge) => {
    // Check edge kind
    if (!allowedEdgeKinds.has(edge.data.kind)) {
      return false;
    }

    // Check confidence
    if (edge.data.confidence < config.minConfidence) {
      return false;
    }

    // Check source and target are in remaining nodes
    if (!remainingNodeIds.has(edge.data.source) || !remainingNodeIds.has(edge.data.target)) {
      return false;
    }

    return true;
  });

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}

// Re-export types that UI components need
export type { CytoscapeElements, CytoscapeNode, CytoscapeEdge };
export type { Position };
export type { PatternMatch };
