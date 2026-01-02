/**
 * Cytoscape Formatter
 * Converts semantic graph data to Cytoscape.js element format.
 */

import type { Node, Edge } from '../../schema/types.js';
import type { NodeKind, EdgeKind } from '../../constants.js';
import type { PatternMatch } from '../../patterns/types.js';
import type { Position } from '../types.js';

/**
 * Cytoscape node element.
 */
export interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    kind: NodeKind;
    file?: string;
    parent?: string;
    route?: string;
    visibility?: string;
    signature?: string;
    [key: string]: unknown;
  };
  position?: Position;
  classes?: string;
}

/**
 * Cytoscape edge element.
 */
export interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    kind: EdgeKind;
    confidence: number;
    [key: string]: unknown;
  };
  classes?: string;
}

/**
 * Collection of Cytoscape elements.
 */
export interface CytoscapeElements {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

/**
 * Interface for Cytoscape formatting operations.
 */
export interface CytoscapeFormatter {
  /**
   * Format graph data as Cytoscape elements.
   * @param nodes - Semantic graph nodes
   * @param edges - Semantic graph edges
   * @returns Cytoscape-formatted elements
   */
  format(nodes: Node[], edges: Edge[]): CytoscapeElements;

  /**
   * Apply positions to elements.
   * @param elements - Cytoscape elements
   * @param positions - Map of node IDs to positions
   * @returns Elements with positions applied
   */
  applyPositions(
    elements: CytoscapeElements,
    positions: Record<string, Position>
  ): CytoscapeElements;

  /**
   * Add pattern overlay classes.
   * @param elements - Cytoscape elements
   * @param patterns - Pattern matches to highlight
   * @returns Elements with pattern classes applied
   */
  applyPatternOverlay(
    elements: CytoscapeElements,
    patterns: PatternMatch[]
  ): CytoscapeElements;
}

/**
 * CSS class mappings for node kinds.
 */
const NODE_KIND_CLASSES: Record<NodeKind, string> = {
  module: 'node-module',
  class: 'node-class',
  interface: 'node-interface',
  trait: 'node-trait',
  function: 'node-function',
  method: 'node-method',
  field: 'node-field',
  property: 'node-property',
};

/**
 * CSS class mappings for edge kinds.
 */
const EDGE_KIND_CLASSES: Record<EdgeKind, string> = {
  defines: 'edge-defines',
  imports: 'edge-imports',
  calls: 'edge-calls',
  inherits: 'edge-inherits',
  implements: 'edge-implements',
  uses: 'edge-uses',
  reads: 'edge-reads',
  writes: 'edge-writes',
  throws: 'edge-throws',
};

/**
 * Implementation of the CytoscapeFormatter interface.
 */
class CytoscapeFormatterImpl implements CytoscapeFormatter {
  /**
   * Format graph data as Cytoscape elements.
   */
  format(nodes: Node[], edges: Edge[]): CytoscapeElements {
    const cytoscapeNodes: CytoscapeNode[] = nodes.map((node) => ({
      data: {
        id: node.node_id,
        label: node.name,
        kind: node.kind,
        file: node.file,
        parent: node.parent,
        route: node.route,
        visibility: node.visibility,
        signature: node.signature,
        language: node.language,
      },
      classes: NODE_KIND_CLASSES[node.kind] || 'node-unknown',
    }));

    const cytoscapeEdges: CytoscapeEdge[] = edges.map((edge) => ({
      data: {
        id: edge.edge_id,
        source: edge.src,
        target: edge.dst,
        kind: edge.kind,
        confidence: edge.confidence,
        evidence: edge.evidence,
      },
      classes: EDGE_KIND_CLASSES[edge.kind] || 'edge-unknown',
    }));

    return {
      nodes: cytoscapeNodes,
      edges: cytoscapeEdges,
    };
  }

  /**
   * Apply positions to elements.
   */
  applyPositions(
    elements: CytoscapeElements,
    positions: Record<string, Position>
  ): CytoscapeElements {
    const nodesWithPositions = elements.nodes.map((node) => {
      const position = positions[node.data.id];
      if (position) {
        return {
          ...node,
          position: { ...position },
        };
      }
      return node;
    });

    return {
      nodes: nodesWithPositions,
      edges: elements.edges,
    };
  }

  /**
   * Add pattern overlay classes.
   */
  applyPatternOverlay(
    elements: CytoscapeElements,
    patterns: PatternMatch[]
  ): CytoscapeElements {
    // Collect all node IDs that participate in patterns
    const patternNodeIds = new Map<string, Set<string>>();

    for (const pattern of patterns) {
      for (const nodeIdOrArray of Object.values(pattern.roles)) {
        const nodeIds = Array.isArray(nodeIdOrArray) ? nodeIdOrArray : [nodeIdOrArray];
        for (const nodeId of nodeIds) {
          if (!patternNodeIds.has(nodeId)) {
            patternNodeIds.set(nodeId, new Set());
          }
          patternNodeIds.get(nodeId)!.add(pattern.patternId);
        }
      }
    }

    // Apply pattern classes to nodes
    const nodesWithPatterns = elements.nodes.map((node) => {
      const patterns = patternNodeIds.get(node.data.id);
      if (patterns && patterns.size > 0) {
        const patternClasses = Array.from(patterns)
          .map((p) => `pattern-${p.toLowerCase().replace(/[^a-z0-9]/g, '-')}`)
          .join(' ');
        const existingClasses = node.classes || '';
        return {
          ...node,
          classes: `${existingClasses} pattern-member ${patternClasses}`.trim(),
        };
      }
      return node;
    });

    return {
      nodes: nodesWithPatterns,
      edges: elements.edges,
    };
  }
}

/**
 * Create a new Cytoscape formatter instance.
 */
export function createFormatter(): CytoscapeFormatter {
  return new CytoscapeFormatterImpl();
}
