/**
 * Cytoscape Styles Tests
 * Tests for stylesheet generation and color mappings.
 */

import { describe, it, expect } from 'vitest';
import {
  getDefaultStylesheet,
  getNodeKindColor,
  getEdgeKindColor,
  getPatternOverlayStyles,
  getHighlightStyles,
  type CytoscapeStyle,
} from '../../../src/ui/graph/styles.js';
import { NODE_KINDS, EDGE_KINDS } from '../../../src/constants.js';

describe('getDefaultStylesheet', () => {
  it('should return an array of styles', () => {
    const styles = getDefaultStylesheet();
    expect(Array.isArray(styles)).toBe(true);
    expect(styles.length).toBeGreaterThan(0);
  });

  it('should have a base node selector', () => {
    const styles = getDefaultStylesheet();
    const nodeStyle = styles.find((s) => s.selector === 'node');
    expect(nodeStyle).toBeDefined();
    expect(nodeStyle?.style).toBeDefined();
  });

  it('should have a base edge selector', () => {
    const styles = getDefaultStylesheet();
    const edgeStyle = styles.find((s) => s.selector === 'edge');
    expect(edgeStyle).toBeDefined();
    expect(edgeStyle?.style).toBeDefined();
  });

  it('should have styles for all node kinds', () => {
    const styles = getDefaultStylesheet();
    for (const kind of NODE_KINDS) {
      const selector = `.node-${kind}`;
      const kindStyle = styles.find((s) => s.selector === selector);
      expect(kindStyle, `Missing style for ${selector}`).toBeDefined();
    }
  });

  it('should have styles for all edge kinds', () => {
    const styles = getDefaultStylesheet();
    for (const kind of EDGE_KINDS) {
      const selector = `.edge-${kind}`;
      const kindStyle = styles.find((s) => s.selector === selector);
      expect(kindStyle, `Missing style for ${selector}`).toBeDefined();
    }
  });

  it('should define label property on nodes', () => {
    const styles = getDefaultStylesheet();
    const nodeStyle = styles.find((s) => s.selector === 'node');
    expect(nodeStyle?.style).toHaveProperty('label');
  });
});

describe('getNodeKindColor', () => {
  it('should return a color string for each node kind', () => {
    for (const kind of NODE_KINDS) {
      const color = getNodeKindColor(kind);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it('should return different colors for different kinds', () => {
    const colors = new Set<string>();
    for (const kind of NODE_KINDS) {
      colors.add(getNodeKindColor(kind));
    }
    // At least some kinds should have distinct colors
    expect(colors.size).toBeGreaterThan(1);
  });

  it('should return a valid color format', () => {
    for (const kind of NODE_KINDS) {
      const color = getNodeKindColor(kind);
      // Should be a hex color or named color
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$|^[a-z]+$/i);
    }
  });
});

describe('getEdgeKindColor', () => {
  it('should return a color string for each edge kind', () => {
    for (const kind of EDGE_KINDS) {
      const color = getEdgeKindColor(kind);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it('should return different colors for different kinds', () => {
    const colors = new Set<string>();
    for (const kind of EDGE_KINDS) {
      colors.add(getEdgeKindColor(kind));
    }
    // At least some kinds should have distinct colors
    expect(colors.size).toBeGreaterThan(1);
  });

  it('should return a valid color format', () => {
    for (const kind of EDGE_KINDS) {
      const color = getEdgeKindColor(kind);
      // Should be a hex color or named color
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$|^[a-z]+$/i);
    }
  });
});

describe('getPatternOverlayStyles', () => {
  it('should return an array of styles', () => {
    const styles = getPatternOverlayStyles();
    expect(Array.isArray(styles)).toBe(true);
    expect(styles.length).toBeGreaterThan(0);
  });

  it('should have a pattern-member selector', () => {
    const styles = getPatternOverlayStyles();
    const patternStyle = styles.find((s) => s.selector.includes('pattern-member'));
    expect(patternStyle).toBeDefined();
  });

  it('should define visual overlay properties', () => {
    const styles = getPatternOverlayStyles();
    // Pattern styles should modify appearance
    const hasOverlayProperties = styles.some((s) =>
      s.style && (
        'border-width' in s.style ||
        'border-color' in s.style ||
        'background-color' in s.style ||
        'overlay-color' in s.style
      )
    );
    expect(hasOverlayProperties).toBe(true);
  });
});

describe('getHighlightStyles', () => {
  it('should return an array of styles', () => {
    const styles = getHighlightStyles();
    expect(Array.isArray(styles)).toBe(true);
    expect(styles.length).toBeGreaterThan(0);
  });

  it('should have a highlighted selector', () => {
    const styles = getHighlightStyles();
    const highlightStyle = styles.find((s) => s.selector.includes('highlighted'));
    expect(highlightStyle).toBeDefined();
  });

  it('should differ from normal styles', () => {
    const defaultStyles = getDefaultStylesheet();
    const highlightStyles = getHighlightStyles();

    // Highlight should have distinct visual properties
    const highlightStyle = highlightStyles.find((s) => s.selector.includes('highlighted'));
    const nodeStyle = defaultStyles.find((s) => s.selector === 'node');

    if (highlightStyle && nodeStyle) {
      // Check that at least one property differs
      const highlightHasDistinctStyle = Object.keys(highlightStyle.style || {}).some(
        (key) => highlightStyle.style[key] !== (nodeStyle.style as Record<string, unknown>)[key]
      );
      expect(highlightHasDistinctStyle).toBe(true);
    }
  });
});
