/**
 * Query utilities - common graph query operations beyond basic GraphStore methods.
 */

import type { Node, Edge } from '../schema/types.js';
import type { GraphStore, SubgraphResult } from './store.js';

/**
 * A path between two nodes.
 */
export interface Path {
  /** Ordered nodes from start to end */
  nodes: Node[];
  /** Edges connecting the nodes */
  edges: Edge[];
  /** Number of edges in the path */
  length: number;
}

/**
 * Find the shortest path between two nodes using BFS.
 *
 * @param store - The graph store to query
 * @param fromId - Starting node ID
 * @param toId - Target node ID
 * @param maxDepth - Maximum path length to search (default: 10)
 * @returns Path if found, null otherwise
 */
export async function getPath(
  store: GraphStore,
  fromId: string,
  toId: string,
  maxDepth: number = 10
): Promise<Path | null> {
  // Check if nodes exist
  const startNode = await store.getNode(fromId);
  const endNode = await store.getNode(toId);

  if (!startNode || !endNode) {
    return null;
  }

  // Same node - trivial path
  if (fromId === toId) {
    return {
      nodes: [startNode],
      edges: [],
      length: 0,
    };
  }

  // BFS to find shortest path
  interface QueueItem {
    nodeId: string;
    path: string[]; // node IDs in path
    edges: Edge[];
  }

  const visited = new Set<string>();
  const queue: QueueItem[] = [{ nodeId: fromId, path: [fromId], edges: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.path.length > maxDepth + 1) {
      continue;
    }

    if (visited.has(current.nodeId)) {
      continue;
    }
    visited.add(current.nodeId);

    // Get all edges from current node
    const edges = await store.getEdgesForNode(current.nodeId, 'both');

    for (const edge of edges) {
      // Determine the neighbor node
      const neighborId = edge.src === current.nodeId ? edge.dst : edge.src;

      if (visited.has(neighborId)) {
        continue;
      }

      const newPath = [...current.path, neighborId];
      const newEdges = [...current.edges, edge];

      // Found target
      if (neighborId === toId) {
        const nodes = await Promise.all(newPath.map((id) => store.getNode(id)));
        return {
          nodes: nodes.filter((n): n is Node => n !== null),
          edges: newEdges,
          length: newEdges.length,
        };
      }

      queue.push({
        nodeId: neighborId,
        path: newPath,
        edges: newEdges,
      });
    }
  }

  return null;
}

/**
 * Get the connected component containing a node.
 * Uses BFS to find all nodes reachable from the given node.
 *
 * @param store - The graph store to query
 * @param nodeId - Starting node ID
 * @returns SubgraphResult containing all connected nodes and edges
 */
export async function getConnectedComponent(
  store: GraphStore,
  nodeId: string
): Promise<SubgraphResult> {
  // Use getSubgraph with a very large depth to get the full component
  // This is efficient because getSubgraph already handles cycles
  return store.getSubgraph(nodeId, 1000);
}

/**
 * Find nodes by route pattern.
 * Supports glob-like patterns with * and ** wildcards.
 *
 * @param store - The graph store to query
 * @param routePattern - Route pattern (e.g., "app.services.*", "app.**")
 * @returns Matching nodes
 */
export async function findByRoute(
  store: GraphStore,
  routePattern: string
): Promise<Node[]> {
  // Convert glob pattern to regex
  let regexPattern = routePattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*\*/g, '___DOUBLE_STAR___') // Temp placeholder for **
    .replace(/\*/g, '[^.]+') // * matches single segment
    .replace(/___DOUBLE_STAR___/g, '.*'); // ** matches any path

  // Anchor the pattern
  regexPattern = `^${regexPattern}$`;

  const regex = new RegExp(regexPattern);

  return store.findNodes({ route: regex });
}

/**
 * Find nodes defined in a specific file.
 *
 * @param store - The graph store to query
 * @param filePath - File path to match
 * @returns Nodes defined in the file
 */
export async function findByFile(
  store: GraphStore,
  filePath: string
): Promise<Node[]> {
  return store.findNodes({ file: filePath });
}

/**
 * Get all nodes of a specific kind.
 *
 * @param store - The graph store to query
 * @param kind - Node kind to filter by
 * @returns Nodes of the specified kind
 */
export async function findByKind(
  store: GraphStore,
  kind: Node['kind']
): Promise<Node[]> {
  return store.findNodes({ kind });
}

/**
 * Get all callers of a function/method.
 *
 * @param store - The graph store to query
 * @param nodeId - Target function/method node ID
 * @returns Nodes that call the target
 */
export async function getCallers(
  store: GraphStore,
  nodeId: string
): Promise<Node[]> {
  const edges = await store.findEdges({ kind: 'calls', dst: nodeId });
  const callerIds = [...new Set(edges.map((e) => e.src))];

  const callers = await Promise.all(callerIds.map((id) => store.getNode(id)));
  return callers.filter((n): n is Node => n !== null);
}

/**
 * Get all callees of a function/method.
 *
 * @param store - The graph store to query
 * @param nodeId - Source function/method node ID
 * @returns Nodes called by the source
 */
export async function getCallees(
  store: GraphStore,
  nodeId: string
): Promise<Node[]> {
  const edges = await store.findEdges({ kind: 'calls', src: nodeId });
  const calleeIds = [...new Set(edges.map((e) => e.dst))];

  const callees = await Promise.all(calleeIds.map((id) => store.getNode(id)));
  return callees.filter((n): n is Node => n !== null);
}

/**
 * Get the call graph rooted at a node (all transitive callees).
 *
 * @param store - The graph store to query
 * @param nodeId - Root node ID
 * @param maxDepth - Maximum call depth (default: 5)
 * @returns SubgraphResult with the call graph
 */
export async function getCallGraph(
  store: GraphStore,
  nodeId: string,
  maxDepth: number = 5
): Promise<SubgraphResult> {
  return store.getSubgraph(nodeId, maxDepth, ['calls']);
}

/**
 * Find orphan nodes (nodes with no edges).
 *
 * @param store - The graph store to query
 * @returns Nodes with no incoming or outgoing edges
 */
export async function findOrphanNodes(store: GraphStore): Promise<Node[]> {
  const allNodes = await store.findNodes({});
  const orphans: Node[] = [];

  for (const node of allNodes) {
    const edges = await store.getEdgesForNode(node.node_id, 'both');
    if (edges.length === 0) {
      orphans.push(node);
    }
  }

  return orphans;
}

/**
 * Find strongly connected nodes (nodes with both incoming and outgoing edges).
 *
 * @param store - The graph store to query
 * @returns Nodes with both incoming and outgoing edges
 */
export async function findConnectedNodes(store: GraphStore): Promise<Node[]> {
  const allNodes = await store.findNodes({});
  const connected: Node[] = [];

  for (const node of allNodes) {
    const inEdges = await store.getEdgesForNode(node.node_id, 'in');
    const outEdges = await store.getEdgesForNode(node.node_id, 'out');

    if (inEdges.length > 0 && outEdges.length > 0) {
      connected.push(node);
    }
  }

  return connected;
}
