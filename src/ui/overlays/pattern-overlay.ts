/**
 * Pattern Overlay
 * Manages pattern visualization with convex hulls and highlights.
 */

import type { PatternMatch } from '../../patterns/types.js';
import type { PatternOverlayConfig } from '../types.js';

/**
 * Pattern overlay manager interface.
 */
export interface PatternOverlayManager {
  /** Apply overlays to the Cytoscape instance */
  apply(cy: unknown): void;
  /** Update overlay configuration */
  update(config: Partial<PatternOverlayConfig>): void;
  /** Remove all overlays */
  clear(): void;
  /** Highlight a specific pattern instance */
  highlight(instanceId: string): void;
  /** Clear highlighting */
  clearHighlight(): void;
  /** Get nodes participating in patterns */
  getPatternNodes(): Set<string>;
}

/**
 * Get node IDs participating in a pattern.
 * @param pattern - Pattern match to extract nodes from
 * @returns Array of node IDs
 */
export function getPatternNodeIds(pattern: PatternMatch): string[] {
  const nodeIds: string[] = [];

  for (const value of Object.values(pattern.roles)) {
    if (Array.isArray(value)) {
      nodeIds.push(...value);
    } else {
      nodeIds.push(value);
    }
  }

  return nodeIds;
}

/**
 * Cross product of vectors OA and OB where O is the origin.
 * Returns positive if counterclockwise, negative if clockwise, 0 if collinear.
 */
function cross(
  o: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Calculate convex hull points for a set of nodes.
 * Uses Andrew's monotone chain algorithm.
 * @param nodePositions - Array of x/y positions
 * @returns Array of hull points in counterclockwise order
 */
export function calculateConvexHull(
  nodePositions: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  const points = [...nodePositions];

  if (points.length <= 1) {
    return points;
  }

  if (points.length === 2) {
    return points;
  }

  // Sort by x, then by y
  points.sort((a, b) => a.x - b.x || a.y - b.y);

  // Build lower hull
  const lower: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    while (lower.length >= 2) {
      const secondLast = lower[lower.length - 2];
      const last = lower[lower.length - 1];
      if (secondLast && last && cross(secondLast, last, p) <= 0) {
        lower.pop();
      } else {
        break;
      }
    }
    lower.push(p);
  }

  // Build upper hull
  const upper: Array<{ x: number; y: number }> = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (!p) continue;
    while (upper.length >= 2) {
      const secondLast = upper[upper.length - 2];
      const last = upper[upper.length - 1];
      if (secondLast && last && cross(secondLast, last, p) <= 0) {
        upper.pop();
      } else {
        break;
      }
    }
    upper.push(p);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

/**
 * Default hull style.
 */
const DEFAULT_HULL_STYLE = {
  fillColor: '#ffcc00',
  strokeColor: '#ff9900',
  strokeWidth: 2,
  opacity: 0.2,
};

/**
 * Pattern overlay manager implementation.
 */
class PatternOverlayManagerImpl implements PatternOverlayManager {
  private config: PatternOverlayConfig;
  private cy: unknown = null;
  private patternNodes: Set<string> = new Set();
  private highlightedInstanceId: string | null = null;

  constructor(config: PatternOverlayConfig) {
    this.config = { ...config };
    this.buildPatternNodes();
  }

  /**
   * Apply overlays to the Cytoscape instance.
   */
  apply(cy: unknown): void {
    this.cy = cy;

    // Apply pattern-member class to all participating nodes
    for (const nodeId of this.patternNodes) {
      const node = (cy as { getElementById: (id: string) => { length: number; addClass: (c: string) => void } }).getElementById(nodeId);
      if (node && node.length > 0) {
        node.addClass('pattern-member');
      }
    }

    // Apply pattern-specific classes
    for (const pattern of this.config.patterns) {
      const patternClass = `pattern-${pattern.patternId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const nodeIds = getPatternNodeIds(pattern);

      for (const nodeId of nodeIds) {
        const node = (cy as { getElementById: (id: string) => { length: number; addClass: (c: string) => void } }).getElementById(nodeId);
        if (node && node.length > 0) {
          node.addClass(patternClass);
        }
      }
    }

    // Apply initial highlight if set
    if (this.config.highlightedInstance) {
      this.highlight(this.config.highlightedInstance);
    }
  }

  /**
   * Update overlay configuration.
   */
  update(config: Partial<PatternOverlayConfig>): void {
    if (config.patterns !== undefined) {
      this.config.patterns = config.patterns;
      this.buildPatternNodes();
    }
    if (config.hullStyle !== undefined) {
      this.config.hullStyle = { ...this.config.hullStyle, ...config.hullStyle };
    }
    if (config.showLabels !== undefined) {
      this.config.showLabels = config.showLabels;
    }
    if (config.highlightedInstance !== undefined) {
      this.config.highlightedInstance = config.highlightedInstance;
      if (config.highlightedInstance && this.cy) {
        this.highlight(config.highlightedInstance);
      }
    }
  }

  /**
   * Remove all overlays.
   */
  clear(): void {
    if (!this.cy) return;

    const cy = this.cy as {
      elements: () => { removeClass: (classes: string) => void };
    };

    cy.elements().removeClass('pattern-member highlighted highlighted-edge dimmed');

    // Clear pattern-specific classes
    for (const pattern of this.config.patterns) {
      const patternClass = `pattern-${pattern.patternId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      cy.elements().removeClass(patternClass);
    }

    this.highlightedInstanceId = null;
  }

  /**
   * Highlight a specific pattern instance.
   */
  highlight(instanceId: string): void {
    if (!this.cy) return;

    this.clearHighlight();
    this.highlightedInstanceId = instanceId;

    const cy = this.cy as {
      nodes: () => { forEach: (fn: (node: { id: () => string; addClass: (c: string) => void }) => void) => void };
      edges: () => { forEach: (fn: (edge: { source: () => { id: () => string }; target: () => { id: () => string }; addClass: (c: string) => void }) => void) => void };
      getElementById: (id: string) => { length: number; addClass: (c: string) => void };
    };

    // Find the pattern
    const pattern = this.config.patterns.find((p) => p.instanceId === instanceId);
    if (!pattern) return;

    // Get all node IDs in the pattern
    const nodeIds = new Set(getPatternNodeIds(pattern));

    // Highlight nodes in the pattern, dim others
    cy.nodes().forEach((node) => {
      if (nodeIds.has(node.id())) {
        node.addClass('highlighted');
      } else {
        node.addClass('dimmed');
      }
    });

    // Highlight edges between pattern nodes
    cy.edges().forEach((edge) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
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

    const cy = this.cy as {
      elements: () => { removeClass: (classes: string) => void };
    };

    cy.elements().removeClass('highlighted highlighted-edge dimmed');
    this.highlightedInstanceId = null;
  }

  /**
   * Get nodes participating in patterns.
   */
  getPatternNodes(): Set<string> {
    return new Set(this.patternNodes);
  }

  /**
   * Build the set of pattern node IDs.
   */
  private buildPatternNodes(): void {
    this.patternNodes.clear();

    for (const pattern of this.config.patterns) {
      const nodeIds = getPatternNodeIds(pattern);
      for (const nodeId of nodeIds) {
        this.patternNodes.add(nodeId);
      }
    }
  }
}

/**
 * Create a pattern overlay manager.
 */
export function createPatternOverlayManager(config: PatternOverlayConfig): PatternOverlayManager {
  return new PatternOverlayManagerImpl(config);
}
