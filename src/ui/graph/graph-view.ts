/**
 * GraphView
 * Cytoscape.js wrapper component for graph visualization.
 */

import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import type { CytoscapeElements, CytoscapeNode } from '../../view-service/formatter/formatter.js';
import type { Position } from '../../view-service/types.js';
import type { PatternMatch } from '../../patterns/types.js';
import {
  type GraphViewProps,
  type GraphControls,
  type LensConfig,
  DEFAULT_LENS_CONFIG,
  applyLensFilter,
} from '../types.js';
import {
  getDefaultStylesheet,
  getPatternOverlayStyles,
  getHighlightStyles,
} from './styles.js';

/**
 * Extended GraphView interface with lifecycle methods.
 */
export interface GraphView extends GraphControls {
  /** Initialize the graph in a container (pass null for headless mode) */
  init(container: HTMLElement | string | null): void;
  /** Update the graph with new elements */
  update(props: Partial<GraphViewProps>): void;
  /** Destroy the graph instance */
  destroy(): void;
  /** Get the underlying Cytoscape instance (for advanced usage) */
  getCytoscape(): Core | null;
  /** Check if the graph is initialized */
  isInitialized(): boolean;
}

/**
 * GraphView implementation.
 */
class GraphViewImpl implements GraphView {
  private cy: Core | null = null;
  private props: GraphViewProps;
  private lensConfig: LensConfig;
  private expandedNodes: Set<string> = new Set();
  private collapsedNodes: Set<string> = new Set();
  private highlightedPatternId: string | null = null;

  constructor(props: GraphViewProps) {
    this.props = props;
    this.lensConfig = { ...DEFAULT_LENS_CONFIG };
  }

  /**
   * Initialize the graph in a container.
   * Pass null for headless mode (useful for testing).
   */
  init(container: HTMLElement | string | null): void {
    if (this.cy) {
      this.destroy();
    }

    // Build stylesheet
    const stylesheet = [
      ...getDefaultStylesheet(),
      ...getPatternOverlayStyles(),
      ...getHighlightStyles(),
    ];

    // Apply lens filter to elements
    const filteredElements = applyLensFilter(this.props.elements, this.lensConfig);

    // Convert to Cytoscape format
    const elements = this.toCytoscapeElements(filteredElements);

    // Resolve container - if string, try to get element (may be null in headless mode)
    let resolvedContainer: HTMLElement | null | undefined;
    if (container === null) {
      resolvedContainer = null;
    } else if (typeof container === 'string') {
      // In Node.js/headless environment, document may not exist
      resolvedContainer = typeof document !== 'undefined' ? document.getElementById(container) : null;
    } else {
      resolvedContainer = container;
    }

    // Create Cytoscape instance (pass undefined for headless mode if container is a mock)
    this.cy = cytoscape({
      container: resolvedContainer ?? undefined,
      elements,
      style: stylesheet as cytoscape.Stylesheet[],
      layout: { name: 'preset' },
      userZoomingEnabled: this.props.interactive !== false,
      userPanningEnabled: this.props.interactive !== false,
      boxSelectionEnabled: true,
      selectionType: 'single',
      headless: resolvedContainer === null || resolvedContainer === undefined,
    });

    // Apply positions
    this.applyPositions(this.props.positions);

    // Set up event handlers
    this.setupEventHandlers();

    // Apply pattern overlays if provided
    if (this.props.patterns && this.lensConfig.showPatterns) {
      this.applyPatternClasses(this.props.patterns);
    }
  }

  /**
   * Check if initialized.
   */
  isInitialized(): boolean {
    return this.cy !== null;
  }

  /**
   * Get the Cytoscape instance.
   */
  getCytoscape(): Core | null {
    return this.cy;
  }

  /**
   * Update the graph with new props.
   */
  update(props: Partial<GraphViewProps>): void {
    if (!this.cy) return;

    // Update stored props
    this.props = { ...this.props, ...props };

    if (props.elements) {
      const filteredElements = applyLensFilter(this.props.elements, this.lensConfig);
      const elements = this.toCytoscapeElements(filteredElements);

      // Remove existing and add new
      this.cy.elements().remove();
      this.cy.add(elements);

      // Reapply pattern classes
      if (this.props.patterns && this.lensConfig.showPatterns) {
        this.applyPatternClasses(this.props.patterns);
      }
    }

    if (props.positions) {
      this.applyPositions(props.positions);
    }

    if (props.patterns && this.lensConfig.showPatterns) {
      this.applyPatternClasses(props.patterns);
    }
  }

  /**
   * Destroy the graph instance.
   */
  destroy(): void {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
    this.expandedNodes.clear();
    this.collapsedNodes.clear();
    this.highlightedPatternId = null;
  }

  /**
   * Set lens configuration.
   */
  setLens(config: LensConfig): void {
    this.lensConfig = { ...config };

    if (this.cy) {
      const filteredElements = applyLensFilter(this.props.elements, this.lensConfig);
      const elements = this.toCytoscapeElements(filteredElements);

      this.cy.elements().remove();
      this.cy.add(elements);

      this.applyPositions(this.props.positions);

      if (this.props.patterns && this.lensConfig.showPatterns) {
        this.applyPatternClasses(this.props.patterns);
      }
    }
  }

  /**
   * Get lens configuration.
   */
  getLens(): LensConfig {
    return { ...this.lensConfig };
  }

  /**
   * Expand a node.
   */
  async expandNode(nodeId: string): Promise<void> {
    this.expandedNodes.add(nodeId);
    this.collapsedNodes.delete(nodeId);

    // In a real implementation, this would fetch children from the API
    // For now, we just track the state
    if (this.props.onNodeExpand) {
      this.props.onNodeExpand(nodeId);
    }
  }

  /**
   * Collapse a node.
   */
  collapseNode(nodeId: string): void {
    this.expandedNodes.delete(nodeId);
    this.collapsedNodes.add(nodeId);

    if (this.props.onNodeCollapse) {
      this.props.onNodeCollapse(nodeId);
    }
  }

  /**
   * Highlight a pattern.
   */
  highlightPattern(instanceId: string): void {
    if (!this.cy) return;

    this.clearHighlight();
    this.highlightedPatternId = instanceId;

    // Find the pattern
    const pattern = this.props.patterns?.find((p) => p.instanceId === instanceId);
    if (!pattern) return;

    // Get all node IDs in the pattern
    const nodeIds = new Set<string>();
    for (const roleValue of Object.values(pattern.roles)) {
      if (Array.isArray(roleValue)) {
        roleValue.forEach((id) => nodeIds.add(id));
      } else {
        nodeIds.add(roleValue);
      }
    }

    // Highlight nodes in the pattern
    this.cy.nodes().forEach((node: NodeSingular) => {
      if (nodeIds.has(node.id())) {
        node.addClass('highlighted');
      } else {
        node.addClass('dimmed');
      }
    });

    // Highlight edges between pattern nodes
    this.cy.edges().forEach((edge: EdgeSingular) => {
      if (nodeIds.has(edge.source().id()) && nodeIds.has(edge.target().id())) {
        edge.addClass('highlighted-edge');
      } else {
        edge.addClass('dimmed');
      }
    });
  }

  /**
   * Clear highlighting.
   */
  clearHighlight(): void {
    if (!this.cy) return;

    this.highlightedPatternId = null;
    this.cy.elements().removeClass('highlighted highlighted-edge dimmed');
  }

  /**
   * Fit to view.
   */
  fitToView(): void {
    if (!this.cy) return;
    this.cy.fit();
  }

  /**
   * Center on a node.
   */
  centerOnNode(nodeId: string): void {
    if (!this.cy) return;
    const node = this.cy.getElementById(nodeId);
    if (node.length > 0) {
      this.cy.center(node);
    }
  }

  /**
   * Export as PNG.
   * Returns empty blob in headless mode.
   */
  async exportPNG(): Promise<Blob> {
    if (!this.cy) {
      return new Blob([], { type: 'image/png' });
    }

    try {
      const dataUrl = this.cy.png({ full: true, scale: 2 });
      const response = await fetch(dataUrl);
      return response.blob();
    } catch {
      // Headless mode cannot render images
      return new Blob([], { type: 'image/png' });
    }
  }

  /**
   * Export as SVG.
   * Returns empty string in headless mode.
   */
  exportSVG(): string {
    if (!this.cy) {
      return '';
    }
    try {
      // svg() may not be available in headless mode
      if (typeof (this.cy as unknown as { svg?: unknown }).svg === 'function') {
        return (this.cy as unknown as { svg: (opts: { full: boolean }) => string }).svg({ full: true });
      }
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Get zoom level.
   */
  getZoom(): number {
    return this.cy?.zoom() ?? 1;
  }

  /**
   * Set zoom level.
   */
  setZoom(level: number): void {
    if (!this.cy) return;
    this.cy.zoom(level);
  }

  /**
   * Get expanded nodes.
   */
  getExpandedNodes(): Set<string> {
    return new Set(this.expandedNodes);
  }

  /**
   * Get collapsed nodes.
   */
  getCollapsedNodes(): Set<string> {
    return new Set(this.collapsedNodes);
  }

  /**
   * Convert elements to Cytoscape format.
   */
  private toCytoscapeElements(elements: CytoscapeElements): cytoscape.ElementDefinition[] {
    const result: cytoscape.ElementDefinition[] = [];

    for (const node of elements.nodes) {
      result.push({
        group: 'nodes',
        data: node.data,
        classes: node.classes,
      });
    }

    for (const edge of elements.edges) {
      result.push({
        group: 'edges',
        data: edge.data,
        classes: edge.classes,
      });
    }

    return result;
  }

  /**
   * Apply positions to nodes.
   */
  private applyPositions(positions: Record<string, Position>): void {
    if (!this.cy) return;

    for (const [nodeId, position] of Object.entries(positions)) {
      const node = this.cy.getElementById(nodeId);
      if (node.length > 0) {
        node.position(position);
      }
    }
  }

  /**
   * Apply pattern classes to nodes.
   */
  private applyPatternClasses(patterns: PatternMatch[]): void {
    if (!this.cy) return;

    // Build a map of node ID to pattern IDs
    const nodePatterns = new Map<string, Set<string>>();

    for (const pattern of patterns) {
      for (const roleValue of Object.values(pattern.roles)) {
        const nodeIds = Array.isArray(roleValue) ? roleValue : [roleValue];
        for (const nodeId of nodeIds) {
          if (!nodePatterns.has(nodeId)) {
            nodePatterns.set(nodeId, new Set());
          }
          nodePatterns.get(nodeId)!.add(pattern.patternId);
        }
      }
    }

    // Apply classes
    for (const [nodeId, patternIds] of nodePatterns) {
      const node = this.cy.getElementById(nodeId);
      if (node.length > 0) {
        node.addClass('pattern-member');
        for (const patternId of patternIds) {
          node.addClass(`pattern-${patternId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
        }
      }
    }
  }

  /**
   * Set up event handlers.
   */
  private setupEventHandlers(): void {
    if (!this.cy) return;

    // Node click
    this.cy.on('tap', 'node', (event) => {
      const node = event.target;
      if (this.props.onNodeClick) {
        const cytoscapeNode: CytoscapeNode = {
          data: node.data(),
          classes: node.classes().join(' '),
          position: node.position(),
        };
        this.props.onNodeClick(node.id(), cytoscapeNode);
      }
    });

    // Node double-click for expand
    this.cy.on('dbltap', 'node', (event) => {
      const node = event.target;
      if (this.props.onNodeExpand) {
        this.props.onNodeExpand(node.id());
      }
    });

    // Edge click
    this.cy.on('tap', 'edge', (event) => {
      const edge = event.target;
      if (this.props.onEdgeClick) {
        this.props.onEdgeClick(edge.id());
      }
    });
  }
}

/**
 * Create a new GraphView instance.
 */
export function createGraphView(props: GraphViewProps): GraphView {
  return new GraphViewImpl(props);
}
