/**
 * Cytoscape Styles
 * Defines stylesheets for graph visualization.
 */

import type { NodeKind, EdgeKind } from '../../constants.js';

/**
 * Cytoscape stylesheet definition.
 */
export interface CytoscapeStyle {
  selector: string;
  style: Record<string, unknown>;
}

/**
 * Color palette for node kinds.
 */
const NODE_KIND_COLORS: Record<NodeKind, string> = {
  module: '#4a90d9',    // Blue
  class: '#67b168',     // Green
  interface: '#9b59b6', // Purple
  trait: '#8e44ad',     // Dark purple
  function: '#e67e22',  // Orange
  method: '#f1c40f',    // Yellow
  field: '#95a5a6',     // Gray
  property: '#7f8c8d',  // Dark gray
};

/**
 * Color palette for edge kinds.
 */
const EDGE_KIND_COLORS: Record<EdgeKind, string> = {
  defines: '#3498db',   // Blue
  imports: '#9b59b6',   // Purple
  calls: '#e74c3c',     // Red
  inherits: '#27ae60',  // Green
  implements: '#16a085',// Teal
  uses: '#f39c12',      // Orange
  reads: '#1abc9c',     // Turquoise
  writes: '#e91e63',    // Pink
  throws: '#795548',    // Brown
};

/**
 * Get color for a node kind.
 * @param kind - The node kind
 * @returns Hex color string
 */
export function getNodeKindColor(kind: NodeKind): string {
  return NODE_KIND_COLORS[kind] || '#cccccc';
}

/**
 * Get color for an edge kind.
 * @param kind - The edge kind
 * @returns Hex color string
 */
export function getEdgeKindColor(kind: EdgeKind): string {
  return EDGE_KIND_COLORS[kind] || '#999999';
}

/**
 * Get the default stylesheet for the graph.
 * Includes base styles and kind-specific styles.
 * @returns Array of Cytoscape style definitions
 */
export function getDefaultStylesheet(): CytoscapeStyle[] {
  const styles: CytoscapeStyle[] = [];

  // Base node style
  styles.push({
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'background-color': '#cccccc',
      'border-width': 2,
      'border-color': '#888888',
      'width': 60,
      'height': 40,
      'shape': 'roundrectangle',
      'font-size': 12,
      'text-wrap': 'ellipsis',
      'text-max-width': 55,
    },
  });

  // Base edge style
  styles.push({
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#999999',
      'target-arrow-color': '#999999',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.2,
    },
  });

  // Node kind styles
  styles.push({
    selector: '.node-module',
    style: {
      'background-color': NODE_KIND_COLORS.module,
      'border-color': '#3a7ac0',
      'shape': 'rectangle',
      'width': 80,
      'height': 50,
    },
  });

  styles.push({
    selector: '.node-class',
    style: {
      'background-color': NODE_KIND_COLORS.class,
      'border-color': '#4a9a4b',
      'shape': 'roundrectangle',
    },
  });

  styles.push({
    selector: '.node-interface',
    style: {
      'background-color': NODE_KIND_COLORS.interface,
      'border-color': '#7c3f8e',
      'shape': 'diamond',
      'width': 50,
      'height': 50,
    },
  });

  styles.push({
    selector: '.node-trait',
    style: {
      'background-color': NODE_KIND_COLORS.trait,
      'border-color': '#6e3190',
      'shape': 'diamond',
      'width': 50,
      'height': 50,
    },
  });

  styles.push({
    selector: '.node-function',
    style: {
      'background-color': NODE_KIND_COLORS.function,
      'border-color': '#c5681d',
      'shape': 'ellipse',
      'width': 55,
      'height': 35,
    },
  });

  styles.push({
    selector: '.node-method',
    style: {
      'background-color': NODE_KIND_COLORS.method,
      'border-color': '#c9a30d',
      'shape': 'ellipse',
      'width': 55,
      'height': 35,
    },
  });

  styles.push({
    selector: '.node-field',
    style: {
      'background-color': NODE_KIND_COLORS.field,
      'border-color': '#7b8a8b',
      'shape': 'rectangle',
      'width': 45,
      'height': 25,
    },
  });

  styles.push({
    selector: '.node-property',
    style: {
      'background-color': NODE_KIND_COLORS.property,
      'border-color': '#626e6f',
      'shape': 'rectangle',
      'width': 45,
      'height': 25,
    },
  });

  // Edge kind styles
  styles.push({
    selector: '.edge-defines',
    style: {
      'line-color': EDGE_KIND_COLORS.defines,
      'target-arrow-color': EDGE_KIND_COLORS.defines,
      'line-style': 'solid',
    },
  });

  styles.push({
    selector: '.edge-imports',
    style: {
      'line-color': EDGE_KIND_COLORS.imports,
      'target-arrow-color': EDGE_KIND_COLORS.imports,
      'line-style': 'dashed',
    },
  });

  styles.push({
    selector: '.edge-calls',
    style: {
      'line-color': EDGE_KIND_COLORS.calls,
      'target-arrow-color': EDGE_KIND_COLORS.calls,
      'line-style': 'solid',
      'width': 3,
    },
  });

  styles.push({
    selector: '.edge-inherits',
    style: {
      'line-color': EDGE_KIND_COLORS.inherits,
      'target-arrow-color': EDGE_KIND_COLORS.inherits,
      'line-style': 'solid',
      'target-arrow-shape': 'triangle-tee',
    },
  });

  styles.push({
    selector: '.edge-implements',
    style: {
      'line-color': EDGE_KIND_COLORS.implements,
      'target-arrow-color': EDGE_KIND_COLORS.implements,
      'line-style': 'dashed',
      'target-arrow-shape': 'triangle-tee',
    },
  });

  styles.push({
    selector: '.edge-uses',
    style: {
      'line-color': EDGE_KIND_COLORS.uses,
      'target-arrow-color': EDGE_KIND_COLORS.uses,
      'line-style': 'dotted',
    },
  });

  styles.push({
    selector: '.edge-reads',
    style: {
      'line-color': EDGE_KIND_COLORS.reads,
      'target-arrow-color': EDGE_KIND_COLORS.reads,
      'line-style': 'solid',
      'width': 1.5,
    },
  });

  styles.push({
    selector: '.edge-writes',
    style: {
      'line-color': EDGE_KIND_COLORS.writes,
      'target-arrow-color': EDGE_KIND_COLORS.writes,
      'line-style': 'solid',
      'width': 1.5,
    },
  });

  styles.push({
    selector: '.edge-throws',
    style: {
      'line-color': EDGE_KIND_COLORS.throws,
      'target-arrow-color': EDGE_KIND_COLORS.throws,
      'line-style': 'dashed',
      'target-arrow-shape': 'diamond',
    },
  });

  // Compound node (parent) style
  styles.push({
    selector: ':parent',
    style: {
      'background-opacity': 0.2,
      'border-width': 2,
      'border-style': 'dashed',
      'padding': 20,
    },
  });

  // Selected state
  styles.push({
    selector: ':selected',
    style: {
      'border-width': 4,
      'border-color': '#2196f3',
    },
  });

  return styles;
}

/**
 * Get styles for pattern overlay.
 * Applied to nodes that participate in detected patterns.
 * @returns Array of pattern overlay styles
 */
export function getPatternOverlayStyles(): CytoscapeStyle[] {
  return [
    {
      selector: '.pattern-member',
      style: {
        'border-width': 4,
        'border-color': '#ff9800',
        'border-style': 'double',
      },
    },
    {
      selector: '.pattern-observer',
      style: {
        'background-color': '#fff3e0',
        'border-color': '#ff9800',
      },
    },
    {
      selector: '.pattern-strategy',
      style: {
        'background-color': '#e8f5e9',
        'border-color': '#4caf50',
      },
    },
    {
      selector: '.pattern-factory',
      style: {
        'background-color': '#e3f2fd',
        'border-color': '#2196f3',
      },
    },
    {
      selector: '.pattern-singleton',
      style: {
        'background-color': '#fce4ec',
        'border-color': '#e91e63',
      },
    },
  ];
}

/**
 * Get styles for highlighted elements.
 * Applied when highlighting a specific pattern or node.
 * @returns Array of highlight styles
 */
export function getHighlightStyles(): CytoscapeStyle[] {
  return [
    {
      selector: '.highlighted',
      style: {
        'border-width': 5,
        'border-color': '#ff5722',
        'background-color': '#ffccbc',
        'z-index': 999,
      },
    },
    {
      selector: '.highlighted-edge',
      style: {
        'line-color': '#ff5722',
        'target-arrow-color': '#ff5722',
        'width': 4,
        'z-index': 999,
      },
    },
    {
      selector: '.dimmed',
      style: {
        'opacity': 0.3,
      },
    },
  ];
}
