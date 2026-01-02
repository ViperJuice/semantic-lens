/**
 * ELK Layout Client
 * Computes deterministic graph layouts using ELK (Eclipse Layout Kernel).
 */

import ELKModule from 'elkjs';
import type { ELK, ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs';
import type { Node, Edge } from '../../schema/types.js';
import type { Position } from '../types.js';

// Handle CJS/ESM interop - elkjs exports a constructor as default
const ELKConstructor = (ELKModule as unknown as { default: typeof ELKModule }).default || ELKModule;

/**
 * Default ELK layout options for hierarchical/layered layout.
 */
const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '50',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  'elk.edgeRouting': 'ORTHOGONAL',
  // Ensure deterministic output
  'elk.randomSeed': '1',
};

/**
 * Default node dimensions.
 */
const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 40;

/**
 * Interface for ELK layout operations.
 */
export interface ELKLayoutEngine {
  /**
   * Compute layout positions for nodes.
   * @param nodes - Nodes to layout
   * @param edges - Edges between nodes
   * @returns Map of node IDs to positions
   */
  layout(nodes: Node[], edges: Edge[]): Promise<Record<string, Position>>;

  /**
   * Layout a single connected component.
   * @param nodes - Nodes in the component
   * @param edges - Edges in the component
   * @returns Map of node IDs to positions
   */
  layoutComponent(nodes: Node[], edges: Edge[]): Promise<Record<string, Position>>;
}

/**
 * Implementation of the ELKLayoutEngine interface.
 */
class ELKLayoutEngineImpl implements ELKLayoutEngine {
  private elk: ELK;
  private layoutOptions: LayoutOptions;

  constructor(options?: LayoutOptions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.elk = new (ELKConstructor as any)();
    this.layoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  }

  /**
   * Convert semantic graph nodes to ELK nodes.
   */
  private toElkNodes(nodes: Node[]): ElkNode[] {
    return nodes.map((node) => ({
      id: node.node_id,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      labels: [{ text: node.name }],
    }));
  }

  /**
   * Convert semantic graph edges to ELK edges.
   */
  private toElkEdges(edges: Edge[], nodeIds: Set<string>): ElkExtendedEdge[] {
    // Only include edges where both endpoints exist
    return edges
      .filter((edge) => nodeIds.has(edge.src) && nodeIds.has(edge.dst))
      .map((edge) => ({
        id: edge.edge_id,
        sources: [edge.src],
        targets: [edge.dst],
      }));
  }

  /**
   * Extract positions from ELK layout result.
   */
  private extractPositions(elkGraph: ElkNode): Record<string, Position> {
    const positions: Record<string, Position> = {};

    const processNode = (node: ElkNode, offsetX = 0, offsetY = 0) => {
      if (node.id && node.x !== undefined && node.y !== undefined) {
        positions[node.id] = {
          x: node.x + offsetX,
          y: node.y + offsetY,
        };
      }

      // Process children with offset
      if (node.children) {
        for (const child of node.children) {
          processNode(
            child,
            offsetX + (node.x || 0),
            offsetY + (node.y || 0)
          );
        }
      }
    };

    // Process top-level children
    if (elkGraph.children) {
      for (const child of elkGraph.children) {
        processNode(child, 0, 0);
      }
    }

    return positions;
  }

  /**
   * Compute layout positions for nodes.
   */
  async layout(nodes: Node[], edges: Edge[]): Promise<Record<string, Position>> {
    if (nodes.length === 0) {
      return {};
    }

    if (nodes.length === 1) {
      // Single node - center it
      const node = nodes[0]!;
      return {
        [node.node_id]: { x: 0, y: 0 },
      };
    }

    const nodeIds = new Set(nodes.map((n) => n.node_id));

    const elkGraph: ElkNode = {
      id: 'root',
      layoutOptions: this.layoutOptions,
      children: this.toElkNodes(nodes),
      edges: this.toElkEdges(edges, nodeIds),
    };

    const layoutResult = await this.elk.layout(elkGraph);
    return this.extractPositions(layoutResult);
  }

  /**
   * Layout a single connected component.
   * Same as layout() but explicitly for a component.
   */
  async layoutComponent(nodes: Node[], edges: Edge[]): Promise<Record<string, Position>> {
    return this.layout(nodes, edges);
  }
}

/**
 * Create a new ELK layout engine instance.
 * @param options - Optional layout options to override defaults
 */
export function createELKLayoutEngine(options?: LayoutOptions): ELKLayoutEngine {
  return new ELKLayoutEngineImpl(options);
}

/**
 * Find connected components in a graph.
 * @param nodes - All nodes
 * @param edges - All edges
 * @returns Array of components, each with nodes and edges
 */
export function findConnectedComponents(
  nodes: Node[],
  edges: Edge[]
): Array<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) {
    return [];
  }

  const nodeMap = new Map(nodes.map((n) => [n.node_id, n]));
  const adjacency = new Map<string, Set<string>>();

  // Build adjacency list
  for (const node of nodes) {
    adjacency.set(node.node_id, new Set());
  }

  for (const edge of edges) {
    if (adjacency.has(edge.src) && adjacency.has(edge.dst)) {
      adjacency.get(edge.src)!.add(edge.dst);
      adjacency.get(edge.dst)!.add(edge.src);
    }
  }

  const visited = new Set<string>();
  const components: Array<{ nodes: Node[]; edges: Edge[] }> = [];

  for (const node of nodes) {
    if (visited.has(node.node_id)) {
      continue;
    }

    // BFS to find all nodes in this component
    const componentNodeIds = new Set<string>();
    const queue = [node.node_id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      componentNodeIds.add(currentId);

      const neighbors = adjacency.get(currentId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }
    }

    // Collect nodes and edges for this component
    const componentNodes = nodes.filter((n) => componentNodeIds.has(n.node_id));
    const componentEdges = edges.filter(
      (e) => componentNodeIds.has(e.src) && componentNodeIds.has(e.dst)
    );

    components.push({ nodes: componentNodes, edges: componentEdges });
  }

  return components;
}

/**
 * Layout multiple connected components with spacing between them.
 * @param engine - ELK layout engine
 * @param nodes - All nodes
 * @param edges - All edges
 * @param componentSpacing - Spacing between components (default: 100)
 */
export async function layoutWithComponents(
  engine: ELKLayoutEngine,
  nodes: Node[],
  edges: Edge[],
  componentSpacing = 100
): Promise<Record<string, Position>> {
  const components = findConnectedComponents(nodes, edges);

  if (components.length === 0) {
    return {};
  }

  const allPositions: Record<string, Position> = {};
  let currentX = 0;

  for (const component of components) {
    const positions = await engine.layoutComponent(component.nodes, component.edges);

    // Find bounding box of this component
    let minX = Infinity;
    let maxX = -Infinity;

    for (const pos of Object.values(positions)) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + DEFAULT_NODE_WIDTH);
    }

    // Offset positions to avoid overlap
    const offsetX = currentX - (minX === Infinity ? 0 : minX);

    for (const [nodeId, pos] of Object.entries(positions)) {
      allPositions[nodeId] = {
        x: pos.x + offsetX,
        y: pos.y,
      };
    }

    // Move currentX past this component
    if (maxX !== -Infinity) {
      currentX = maxX + offsetX + componentSpacing;
    }
  }

  return allPositions;
}
