/**
 * Main Sigma.js viewer wrapper for Semantic Lens.
 * Provides high-level API for graph visualization with LOD, selection, and edge management.
 */

import Sigma from 'sigma';
import louvainDefault from 'graphology-communities-louvain';
import forceAtlas2Default, { inferSettings } from 'graphology-layout-forceatlas2';
import type { SemanticGraph, GraphNodeAttributes } from './buildGraph.js';
import {
  ViewState,
  LODLevel,
  EdgeMode,
  createInitialState,
  getLODFromZoom,
  getZoomForLOD,
  getNodeSizeForLOD,
  getLabelSettingsForLOD,
} from './viewState.js';
import { projectGraph, applyProjection, findNodes, getNeighbors } from './projection.js';

// Type workaround for CJS/ESM interop
const louvain = louvainDefault as typeof louvainDefault & {
  assign: (graph: SemanticGraph) => void;
};
const forceAtlas2 = forceAtlas2Default as typeof forceAtlas2Default & {
  assign: (graph: SemanticGraph, options: { iterations: number; settings: Record<string, unknown> }) => void;
};

/**
 * Options for creating a SemanticLensViewer.
 */
export interface ViewerOptions {
  /** Container element for the Sigma canvas */
  container: HTMLElement;
  /** Graphology graph to render */
  graph: SemanticGraph;
  /** Set of isolate node IDs */
  isolates: Set<string>;
  /** Whether to run initial ForceAtlas2 layout. Default: true */
  runLayout?: boolean;
  /** ForceAtlas2 iterations for initial layout. Default: 100 */
  layoutIterations?: number;
}

/**
 * Event types emitted by the viewer.
 */
export interface ViewerEvents {
  /** Fired when a node is clicked */
  nodeClick: (nodeId: string) => void;
  /** Fired when selection changes */
  selectionChange: (selected: string[]) => void;
  /** Fired when LOD level changes */
  lodChange: (lod: LODLevel) => void;
  /** Fired when edge mode changes */
  edgeModeChange: (mode: EdgeMode) => void;
}

/**
 * Main viewer class for Semantic Lens graph visualization.
 */
export class SemanticLensViewer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sigma: Sigma<any, any, any>;
  private graph: SemanticGraph;
  private isolates: Set<string>;
  private state: ViewState;
  private eventHandlers: Partial<ViewerEvents> = {};

  constructor(options: ViewerOptions) {
    this.graph = options.graph;
    this.isolates = options.isolates;
    this.state = createInitialState();

    // Run community detection (Louvain algorithm)
    this.detectCommunities();

    // Position isolates in a ring
    this.positionIsolateRing();

    // Run initial layout if requested
    if (options.runLayout !== false) {
      this.runLayout(options.layoutIterations ?? 100);
    }

    // Initialize Sigma renderer
    this.sigma = new Sigma(this.graph, options.container, {
      renderLabels: true,
      labelRenderedSizeThreshold: 8,
      labelFont: 'Inter, system-ui, sans-serif',
      labelSize: 12,
      labelColor: { color: '#e0e0e0' },
      defaultNodeColor: '#666',
      defaultEdgeColor: '#555',
      defaultEdgeType: 'arrow',
      minCameraRatio: 0.05,
      maxCameraRatio: 10,
      allowInvalidContainer: true,
      // Node reducer for dynamic styling
      nodeReducer: (node, data) => {
        const isSelected = this.state.selectedNodes.has(node);
        const baseSize = getNodeSizeForLOD(this.state.lod, (data as GraphNodeAttributes).size ?? 5);

        return {
          ...data,
          size: isSelected ? baseSize * 1.5 : baseSize,
          color: isSelected ? '#ffffff' : (data as GraphNodeAttributes).color,
        };
      },
      // Edge reducer for dynamic styling
      edgeReducer: (edge, data) => {
        const [src, dst] = this.graph.extremities(edge);
        const srcSelected = this.state.selectedNodes.has(src);
        const dstSelected = this.state.selectedNodes.has(dst);
        const isHighlighted = srcSelected || dstSelected;

        return {
          ...data,
          color: isHighlighted ? '#888' : '#404040',
          size: isHighlighted ? 2 : 1,
        };
      },
    });

    // Set up event listeners
    this.setupEventListeners();

    // Apply initial projection
    this.refresh();
  }

  /**
   * Runs community detection using Louvain algorithm.
   */
  private detectCommunities(): void {
    try {
      louvain.assign(this.graph);
    } catch (err) {
      console.warn('Community detection failed:', err);
    }
  }

  /**
   * Positions isolate nodes in a deterministic ring around the main graph.
   */
  private positionIsolateRing(): void {
    // Get bounding box of non-isolate nodes
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    this.graph.forEachNode((nodeId: string, attrs: GraphNodeAttributes) => {
      if (!this.isolates.has(nodeId)) {
        minX = Math.min(minX, attrs.x);
        maxX = Math.max(maxX, attrs.x);
        minY = Math.min(minY, attrs.y);
        maxY = Math.max(maxY, attrs.y);
      }
    });

    // Handle case where all nodes are isolates
    if (!isFinite(minX)) {
      minX = 0;
      maxX = 1000;
      minY = 0;
      maxY = 1000;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const radius = Math.max(maxX - minX, maxY - minY) * 0.6 + 200;

    // Sort isolates by ID for deterministic positioning
    const isolateArray = Array.from(this.isolates).sort();

    isolateArray.forEach((nodeId, i) => {
      const angle = (2 * Math.PI * i) / isolateArray.length - Math.PI / 2;
      this.graph.setNodeAttribute(nodeId, 'x', centerX + radius * Math.cos(angle));
      this.graph.setNodeAttribute(nodeId, 'y', centerY + radius * Math.sin(angle));
    });
  }

  /**
   * Runs ForceAtlas2 layout on non-isolate nodes.
   */
  private runLayout(iterations: number): void {
    // Run synchronous ForceAtlas2
    const settings = inferSettings(this.graph);
    forceAtlas2.assign(this.graph, {
      iterations,
      settings: {
        ...settings,
        gravity: 1,
        scalingRatio: 10,
        barnesHutOptimize: true,
      },
    });

    // Reposition isolates after layout
    this.positionIsolateRing();
  }

  /**
   * Sets up Sigma event listeners.
   */
  private setupEventListeners(): void {
    // Click to select/deselect
    this.sigma.on('clickNode', ({ node }) => {
      this.toggleSelection(node);
      this.eventHandlers.nodeClick?.(node);
    });

    // Click on background to clear selection
    this.sigma.on('clickStage', () => {
      if (this.state.selectedNodes.size > 0) {
        this.clearSelection();
      }
    });

    // Zoom-based LOD updates
    this.sigma.getCamera().on('updated', () => {
      const ratio = this.sigma.getCamera().ratio;
      const newLOD = getLODFromZoom(ratio);

      if (newLOD !== this.state.lod) {
        this.state.lod = newLOD;
        this.applyLODStyles();
        this.eventHandlers.lodChange?.(newLOD);
      }
    });
  }

  /**
   * Applies LOD-based styling.
   */
  private applyLODStyles(): void {
    const settings = getLabelSettingsForLOD(this.state.lod);

    this.sigma.setSetting('labelRenderedSizeThreshold', settings.sizeThreshold);
    this.sigma.setSetting('labelSize', settings.fontSize);
    this.sigma.refresh();
  }

  /**
   * Refreshes the visualization by reapplying projection.
   */
  refresh(): void {
    const projection = projectGraph(this.graph, this.state);
    applyProjection(this.graph, projection);
    this.sigma.refresh();
  }

  // ============================================
  // Public API - Selection
  // ============================================

  /**
   * Toggles selection of a node.
   */
  toggleSelection(nodeId: string): void {
    if (this.state.selectedNodes.has(nodeId)) {
      this.state.selectedNodes.delete(nodeId);
    } else {
      this.state.selectedNodes.add(nodeId);
    }
    this.refresh();
    this.eventHandlers.selectionChange?.(this.getSelected());
  }

  /**
   * Selects specified nodes (replaces current selection).
   */
  select(nodeIds: string[]): void {
    this.state.selectedNodes = new Set(nodeIds);
    this.refresh();
    this.eventHandlers.selectionChange?.(this.getSelected());
  }

  /**
   * Deselects specified nodes.
   */
  deselect(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.state.selectedNodes.delete(id);
    }
    this.refresh();
    this.eventHandlers.selectionChange?.(this.getSelected());
  }

  /**
   * Clears all selection.
   */
  clearSelection(): void {
    this.state.selectedNodes.clear();
    this.refresh();
    this.eventHandlers.selectionChange?.([]);
  }

  /**
   * Gets currently selected node IDs.
   */
  getSelected(): string[] {
    return Array.from(this.state.selectedNodes);
  }

  // ============================================
  // Public API - Visibility
  // ============================================

  /**
   * Hides specified nodes (can be restored with show).
   */
  hide(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.state.hiddenNodes.add(id);
    }
    this.refresh();
  }

  /**
   * Shows previously hidden nodes.
   */
  show(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.state.hiddenNodes.delete(id);
    }
    this.refresh();
  }

  /**
   * Deletes nodes from the view (cannot be restored in this session).
   */
  delete(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.state.deletedNodes.add(id);
      this.state.selectedNodes.delete(id);
    }
    this.refresh();
  }

  /**
   * Shows all hidden nodes.
   */
  showAll(): void {
    this.state.hiddenNodes.clear();
    this.refresh();
  }

  // ============================================
  // Public API - Navigation
  // ============================================

  /**
   * Centers the camera on specified nodes.
   */
  centerOn(nodeIds: string[]): void {
    if (nodeIds.length === 0) return;

    // Calculate bounding box
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (const nodeId of nodeIds) {
      if (!this.graph.hasNode(nodeId)) continue;
      const x = this.graph.getNodeAttribute(nodeId, 'x') as number;
      const y = this.graph.getNodeAttribute(nodeId, 'y') as number;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    if (!isFinite(minX)) return;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate appropriate zoom ratio
    const width = maxX - minX;
    const height = maxY - minY;
    const viewWidth = this.sigma.getContainer().clientWidth;
    const viewHeight = this.sigma.getContainer().clientHeight;

    let ratio = 1;
    if (width > 0 && height > 0) {
      ratio = Math.max(width / viewWidth, height / viewHeight) * 1.5;
      ratio = Math.max(0.1, Math.min(5, ratio));
    }

    const camera = this.sigma.getCamera();
    camera.animate({ x: centerX, y: centerY, ratio }, { duration: 300 });
  }

  /**
   * Zooms to a specific LOD level.
   */
  zoomTo(lod: LODLevel): void {
    const ratio = getZoomForLOD(lod);
    const camera = this.sigma.getCamera();
    camera.animate({ ratio }, { duration: 300 });
  }

  /**
   * Fits the entire graph in view.
   */
  fit(): void {
    const camera = this.sigma.getCamera();
    camera.animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 300 });
  }

  // ============================================
  // Public API - Edge Control
  // ============================================

  /**
   * Sets the edge visibility mode.
   */
  setEdgeMode(mode: EdgeMode): void {
    this.state.edgeMode = mode;
    this.refresh();
    this.eventHandlers.edgeModeChange?.(mode);
  }

  /**
   * Gets the current edge mode.
   */
  getEdgeMode(): EdgeMode {
    return this.state.edgeMode;
  }

  /**
   * Toggles hiding of edges that cross cluster boundaries.
   */
  setHideExternalEdges(hide: boolean): void {
    this.state.hideExternalEdges = hide;
    this.refresh();
  }

  // ============================================
  // Public API - Isolates
  // ============================================

  /**
   * Sets whether isolate nodes are visible.
   */
  setShowIsolates(show: boolean): void {
    this.state.showIsolates = show;
    this.refresh();
  }

  /**
   * Gets whether isolates are currently shown.
   */
  getShowIsolates(): boolean {
    return this.state.showIsolates;
  }

  // ============================================
  // Public API - Clusters
  // ============================================

  /**
   * Expands a cluster to show its internal structure.
   */
  expandCluster(clusterId: string): void {
    this.state.expandedClusters.add(clusterId);
    this.state.collapsedClusters.delete(clusterId);
    this.refresh();
  }

  /**
   * Collapses a cluster to a single representative node.
   */
  collapseCluster(clusterId: string): void {
    this.state.collapsedClusters.add(clusterId);
    this.state.expandedClusters.delete(clusterId);
    this.refresh();
  }

  // ============================================
  // Public API - State & Query
  // ============================================

  /**
   * Gets the current view state.
   */
  getState(): ViewState {
    return { ...this.state };
  }

  /**
   * Gets the underlying graph.
   */
  getGraph(): SemanticGraph {
    return this.graph;
  }

  /**
   * Gets the Sigma instance.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSigma(): Sigma<any, any, any> {
    return this.sigma;
  }

  /**
   * Finds nodes matching a query.
   */
  findNodes(query: { kind?: string; file?: string; name?: string }): string[] {
    return findNodes(this.graph, query);
  }

  /**
   * Gets node attributes by ID.
   */
  getNodeInfo(nodeId: string): GraphNodeAttributes | null {
    if (!this.graph.hasNode(nodeId)) return null;
    return this.graph.getNodeAttributes(nodeId) as GraphNodeAttributes;
  }

  /**
   * Gets neighbor node IDs.
   */
  getNeighbors(nodeIds: string[], depth: number = 1): string[] {
    return Array.from(getNeighbors(this.graph, new Set(nodeIds), depth));
  }

  /**
   * Gets current LOD level.
   */
  getLOD(): LODLevel {
    return this.state.lod;
  }

  // ============================================
  // Public API - Events
  // ============================================

  /**
   * Registers an event handler.
   */
  on<K extends keyof ViewerEvents>(event: K, handler: ViewerEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Removes an event handler.
   */
  off<K extends keyof ViewerEvents>(event: K): void {
    delete this.eventHandlers[event];
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Destroys the viewer and releases resources.
   */
  destroy(): void {
    this.sigma.kill();
  }
}
