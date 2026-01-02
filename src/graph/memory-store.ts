/**
 * InMemoryStore - In-memory implementation of GraphStore.
 * Uses Maps for O(1) lookups and maintains indexes for efficient queries.
 */

import type {
  Node,
  Edge,
  Annotation,
  PatternInstance,
  SemanticGraphBundle,
} from '../schema/types.js';
import type { NodeKind, EdgeKind } from '../constants.js';
import type {
  GraphStore,
  NodeQuery,
  EdgeQuery,
  SubgraphResult,
  GraphStats,
  Direction,
} from './store.js';
import { GraphStoreError } from './store.js';

/**
 * Internal index structure for fast lookups.
 */
interface GraphIndex {
  /** Nodes indexed by kind */
  nodesByKind: Map<NodeKind, Set<string>>;
  /** Nodes indexed by file path */
  nodesByFile: Map<string, Set<string>>;
  /** Nodes indexed by parent ID */
  nodesByParent: Map<string, Set<string>>;
  /** Nodes indexed by language */
  nodesByLanguage: Map<string, Set<string>>;
  /** Edges indexed by source node */
  edgesBySrc: Map<string, Set<string>>;
  /** Edges indexed by destination node */
  edgesByDst: Map<string, Set<string>>;
  /** Edges indexed by kind */
  edgesByKind: Map<EdgeKind, Set<string>>;
  /** Annotations indexed by target node */
  annotationsByTarget: Map<string, Annotation[]>;
  /** Patterns indexed by involved nodes */
  patternsByNode: Map<string, Set<string>>;
}

/**
 * In-memory implementation of GraphStore.
 * Provides O(1) lookups and efficient query operations through indexing.
 */
export class InMemoryStore implements GraphStore {
  private nodes: Map<string, Node> = new Map();
  private edges: Map<string, Edge> = new Map();
  private patterns: Map<string, PatternInstance> = new Map();

  private index: GraphIndex = {
    nodesByKind: new Map(),
    nodesByFile: new Map(),
    nodesByParent: new Map(),
    nodesByLanguage: new Map(),
    edgesBySrc: new Map(),
    edgesByDst: new Map(),
    edgesByKind: new Map(),
    annotationsByTarget: new Map(),
    patternsByNode: new Map(),
  };

  // === Write Operations ===

  async loadBundle(bundle: SemanticGraphBundle): Promise<void> {
    // Load nodes first to satisfy edge references
    for (const node of bundle.nodes) {
      await this.addNode(node);
    }

    // Load edges
    for (const edge of bundle.edges) {
      await this.addEdge(edge);
    }

    // Load annotations
    for (const annotation of bundle.annotations) {
      await this.addAnnotation(annotation);
    }

    // Load patterns
    for (const pattern of bundle.patterns) {
      await this.addPattern(pattern);
    }
  }

  async addNode(node: Node): Promise<void> {
    if (this.nodes.has(node.node_id)) {
      throw new GraphStoreError(
        `Node with ID '${node.node_id}' already exists`,
        'DUPLICATE_NODE'
      );
    }

    this.nodes.set(node.node_id, node);
    this.indexNode(node);
  }

  async addEdge(edge: Edge): Promise<void> {
    if (this.edges.has(edge.edge_id)) {
      throw new GraphStoreError(
        `Edge with ID '${edge.edge_id}' already exists`,
        'DUPLICATE_EDGE'
      );
    }

    if (!this.nodes.has(edge.src)) {
      throw new GraphStoreError(
        `Source node '${edge.src}' not found for edge '${edge.edge_id}'`,
        'INVALID_REFERENCE'
      );
    }

    if (!this.nodes.has(edge.dst)) {
      throw new GraphStoreError(
        `Destination node '${edge.dst}' not found for edge '${edge.edge_id}'`,
        'INVALID_REFERENCE'
      );
    }

    this.edges.set(edge.edge_id, edge);
    this.indexEdge(edge);
  }

  async addAnnotation(annotation: Annotation): Promise<void> {
    if (!this.nodes.has(annotation.target_id)) {
      throw new GraphStoreError(
        `Target node '${annotation.target_id}' not found for annotation`,
        'INVALID_REFERENCE'
      );
    }

    const existing = this.index.annotationsByTarget.get(annotation.target_id) || [];
    existing.push(annotation);
    this.index.annotationsByTarget.set(annotation.target_id, existing);
  }

  async addPattern(pattern: PatternInstance): Promise<void> {
    this.patterns.set(pattern.instance_id, pattern);
    this.indexPattern(pattern);
  }

  // === Read Operations ===

  async getNode(nodeId: string): Promise<Node | null> {
    return this.nodes.get(nodeId) || null;
  }

  async getEdge(edgeId: string): Promise<Edge | null> {
    return this.edges.get(edgeId) || null;
  }

  async getEdgesForNode(nodeId: string, direction: Direction = 'both'): Promise<Edge[]> {
    const result: Edge[] = [];

    if (direction === 'out' || direction === 'both') {
      const outgoing = this.index.edgesBySrc.get(nodeId);
      if (outgoing) {
        for (const edgeId of outgoing) {
          const edge = this.edges.get(edgeId);
          if (edge) result.push(edge);
        }
      }
    }

    if (direction === 'in' || direction === 'both') {
      const incoming = this.index.edgesByDst.get(nodeId);
      if (incoming) {
        for (const edgeId of incoming) {
          const edge = this.edges.get(edgeId);
          if (edge) result.push(edge);
        }
      }
    }

    return result;
  }

  async getNeighbors(nodeId: string, direction: Direction): Promise<Node[]> {
    const edges = await this.getEdgesForNode(nodeId, direction);
    const neighborIds = new Set<string>();

    for (const edge of edges) {
      if (direction === 'out' || direction === 'both') {
        if (edge.src === nodeId) {
          neighborIds.add(edge.dst);
        }
      }
      if (direction === 'in' || direction === 'both') {
        if (edge.dst === nodeId) {
          neighborIds.add(edge.src);
        }
      }
    }

    const neighbors: Node[] = [];
    for (const id of neighborIds) {
      const node = this.nodes.get(id);
      if (node) neighbors.push(node);
    }

    return neighbors;
  }

  async getAnnotations(nodeId: string): Promise<Annotation[]> {
    return this.index.annotationsByTarget.get(nodeId) || [];
  }

  async getPatternsForNode(nodeId: string): Promise<PatternInstance[]> {
    const patternIds = this.index.patternsByNode.get(nodeId);
    if (!patternIds) return [];

    const patterns: PatternInstance[] = [];
    for (const id of patternIds) {
      const pattern = this.patterns.get(id);
      if (pattern) patterns.push(pattern);
    }

    return patterns;
  }

  // === Query Operations ===

  async findNodes(criteria: NodeQuery): Promise<Node[]> {
    // If no criteria, return all nodes
    if (Object.keys(criteria).length === 0) {
      return Array.from(this.nodes.values());
    }

    // Start with candidate set based on most selective criterion
    let candidates: Set<string> | null = null;

    // Filter by kind
    if (criteria.kind) {
      const kinds = Array.isArray(criteria.kind) ? criteria.kind : [criteria.kind];
      const kindCandidates = new Set<string>();
      for (const kind of kinds) {
        const nodeIds = this.index.nodesByKind.get(kind);
        if (nodeIds) {
          for (const id of nodeIds) kindCandidates.add(id);
        }
      }
      candidates = kindCandidates;
    }

    // Filter by file
    if (criteria.file) {
      const fileNodes = this.index.nodesByFile.get(criteria.file) || new Set();
      candidates = candidates
        ? this.intersectSets(candidates, fileNodes)
        : new Set(fileNodes);
    }

    // Filter by parent
    if (criteria.parent) {
      const parentNodes = this.index.nodesByParent.get(criteria.parent) || new Set();
      candidates = candidates
        ? this.intersectSets(candidates, parentNodes)
        : new Set(parentNodes);
    }

    // Filter by language
    if (criteria.language) {
      const langNodes = this.index.nodesByLanguage.get(criteria.language) || new Set();
      candidates = candidates
        ? this.intersectSets(candidates, langNodes)
        : new Set(langNodes);
    }

    // If no index-based filtering was done, start with all nodes
    if (candidates === null) {
      candidates = new Set(this.nodes.keys());
    }

    // Apply remaining filters that require node inspection
    const result: Node[] = [];
    for (const nodeId of candidates) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      // Filter by route
      if (criteria.route) {
        if (criteria.route instanceof RegExp) {
          if (!node.route || !criteria.route.test(node.route)) continue;
        } else {
          if (node.route !== criteria.route) continue;
        }
      }

      // Filter by visibility
      if (criteria.visibility && node.visibility !== criteria.visibility) {
        continue;
      }

      // Filter by name
      if (criteria.name) {
        if (criteria.name instanceof RegExp) {
          if (!criteria.name.test(node.name)) continue;
        } else {
          if (node.name !== criteria.name) continue;
        }
      }

      result.push(node);
    }

    return result;
  }

  async findEdges(criteria: EdgeQuery): Promise<Edge[]> {
    // If no criteria, return all edges
    if (Object.keys(criteria).length === 0) {
      return Array.from(this.edges.values());
    }

    // Start with candidate set
    let candidates: Set<string> | null = null;

    // Filter by kind
    if (criteria.kind) {
      const kinds = Array.isArray(criteria.kind) ? criteria.kind : [criteria.kind];
      const kindCandidates = new Set<string>();
      for (const kind of kinds) {
        const edgeIds = this.index.edgesByKind.get(kind);
        if (edgeIds) {
          for (const id of edgeIds) kindCandidates.add(id);
        }
      }
      candidates = kindCandidates;
    }

    // Filter by src
    if (criteria.src) {
      const srcEdges = this.index.edgesBySrc.get(criteria.src) || new Set();
      candidates = candidates
        ? this.intersectSets(candidates, srcEdges)
        : new Set(srcEdges);
    }

    // Filter by dst
    if (criteria.dst) {
      const dstEdges = this.index.edgesByDst.get(criteria.dst) || new Set();
      candidates = candidates
        ? this.intersectSets(candidates, dstEdges)
        : new Set(dstEdges);
    }

    // If no index-based filtering was done, start with all edges
    if (candidates === null) {
      candidates = new Set(this.edges.keys());
    }

    // Apply remaining filters
    const result: Edge[] = [];
    for (const edgeId of candidates) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;

      // Filter by minConfidence
      if (criteria.minConfidence !== undefined && edge.confidence < criteria.minConfidence) {
        continue;
      }

      // Filter by evidence (any match)
      if (criteria.evidence && criteria.evidence.length > 0) {
        const hasMatch = criteria.evidence.some((e) => edge.evidence.includes(e));
        if (!hasMatch) continue;
      }

      result.push(edge);
    }

    return result;
  }

  async getSubgraph(
    rootId: string,
    depth: number,
    edgeKinds?: EdgeKind[]
  ): Promise<SubgraphResult> {
    const rootNode = this.nodes.get(rootId);
    if (!rootNode) {
      throw new GraphStoreError(`Root node '${rootId}' not found`, 'NODE_NOT_FOUND');
    }

    const visitedNodes = new Set<string>();
    const subgraphNodes: Node[] = [];
    const subgraphEdges: Edge[] = [];

    // BFS traversal
    const queue: Array<{ nodeId: string; currentDepth: number }> = [
      { nodeId: rootId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const { nodeId, currentDepth } = queue.shift()!;

      if (visitedNodes.has(nodeId)) continue;
      visitedNodes.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) subgraphNodes.push(node);

      // Stop traversal if we've reached max depth
      if (currentDepth >= depth) continue;

      // Get edges for this node
      const edges = await this.getEdgesForNode(nodeId, 'both');

      for (const edge of edges) {
        // Filter by edge kinds if specified
        if (edgeKinds && !edgeKinds.includes(edge.kind)) continue;

        // Determine neighbor
        const neighborId = edge.src === nodeId ? edge.dst : edge.src;

        if (!visitedNodes.has(neighborId)) {
          queue.push({ nodeId: neighborId, currentDepth: currentDepth + 1 });
        }
      }
    }

    // Collect edges where both endpoints are in the subgraph
    const nodeIdSet = new Set(subgraphNodes.map((n) => n.node_id));
    for (const edge of this.edges.values()) {
      if (nodeIdSet.has(edge.src) && nodeIdSet.has(edge.dst)) {
        if (edgeKinds && !edgeKinds.includes(edge.kind)) continue;
        subgraphEdges.push(edge);
      }
    }

    return {
      nodes: subgraphNodes,
      edges: subgraphEdges,
      rootId,
    };
  }

  // === Lifecycle ===

  async clear(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
    this.patterns.clear();

    // Reset all indexes
    this.index = {
      nodesByKind: new Map(),
      nodesByFile: new Map(),
      nodesByParent: new Map(),
      nodesByLanguage: new Map(),
      edgesBySrc: new Map(),
      edgesByDst: new Map(),
      edgesByKind: new Map(),
      annotationsByTarget: new Map(),
      patternsByNode: new Map(),
    };
  }

  async close(): Promise<void> {
    // No-op for in-memory store
    await this.clear();
  }

  async getStats(): Promise<GraphStats> {
    const nodesByKind: Partial<Record<NodeKind, number>> = {};
    const edgesByKind: Partial<Record<EdgeKind, number>> = {};

    for (const [kind, nodeIds] of this.index.nodesByKind) {
      nodesByKind[kind] = nodeIds.size;
    }

    for (const [kind, edgeIds] of this.index.edgesByKind) {
      edgesByKind[kind] = edgeIds.size;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      nodesByKind,
      edgesByKind,
    };
  }

  // === Private Indexing Methods ===

  private indexNode(node: Node): void {
    // Index by kind
    if (!this.index.nodesByKind.has(node.kind)) {
      this.index.nodesByKind.set(node.kind, new Set());
    }
    this.index.nodesByKind.get(node.kind)!.add(node.node_id);

    // Index by file
    if (!this.index.nodesByFile.has(node.file)) {
      this.index.nodesByFile.set(node.file, new Set());
    }
    this.index.nodesByFile.get(node.file)!.add(node.node_id);

    // Index by parent
    if (node.parent) {
      if (!this.index.nodesByParent.has(node.parent)) {
        this.index.nodesByParent.set(node.parent, new Set());
      }
      this.index.nodesByParent.get(node.parent)!.add(node.node_id);
    }

    // Index by language
    if (!this.index.nodesByLanguage.has(node.language)) {
      this.index.nodesByLanguage.set(node.language, new Set());
    }
    this.index.nodesByLanguage.get(node.language)!.add(node.node_id);
  }

  private indexEdge(edge: Edge): void {
    // Index by source
    if (!this.index.edgesBySrc.has(edge.src)) {
      this.index.edgesBySrc.set(edge.src, new Set());
    }
    this.index.edgesBySrc.get(edge.src)!.add(edge.edge_id);

    // Index by destination
    if (!this.index.edgesByDst.has(edge.dst)) {
      this.index.edgesByDst.set(edge.dst, new Set());
    }
    this.index.edgesByDst.get(edge.dst)!.add(edge.edge_id);

    // Index by kind
    if (!this.index.edgesByKind.has(edge.kind)) {
      this.index.edgesByKind.set(edge.kind, new Set());
    }
    this.index.edgesByKind.get(edge.kind)!.add(edge.edge_id);
  }

  private indexPattern(pattern: PatternInstance): void {
    // Index by all involved nodes
    for (const nodeId of Object.values(pattern.roles)) {
      if (!this.index.patternsByNode.has(nodeId)) {
        this.index.patternsByNode.set(nodeId, new Set());
      }
      this.index.patternsByNode.get(nodeId)!.add(pattern.instance_id);
    }
  }

  private intersectSets<T>(a: Set<T>, b: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const item of a) {
      if (b.has(item)) {
        result.add(item);
      }
    }
    return result;
  }
}

/**
 * Factory function to create an InMemoryStore.
 */
export function createInMemoryStore(): GraphStore {
  return new InMemoryStore();
}
