/**
 * GraphView Tests
 * Tests for the Cytoscape wrapper component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createGraphView,
  type GraphView,
} from '../../../src/ui/graph/graph-view.js';
import type { CytoscapeElements } from '../../../src/view-service/formatter/formatter.js';
import type { Position } from '../../../src/view-service/types.js';
import { DEFAULT_LENS_CONFIG, type LensConfig } from '../../../src/ui/types.js';

// Use null for headless mode in Cytoscape (no DOM required)
const createMockContainer = (): null => {
  return null;
};

const createTestElements = (): CytoscapeElements => ({
  nodes: [
    { data: { id: 'node1', label: 'Class1', kind: 'class' }, classes: 'node-class' },
    { data: { id: 'node2', label: 'Method1', kind: 'method' }, classes: 'node-method' },
    { data: { id: 'node3', label: 'Function1', kind: 'function' }, classes: 'node-function' },
  ],
  edges: [
    { data: { id: 'edge1', source: 'node1', target: 'node2', kind: 'defines', confidence: 0.9 }, classes: 'edge-defines' },
    { data: { id: 'edge2', source: 'node2', target: 'node3', kind: 'calls', confidence: 0.7 }, classes: 'edge-calls' },
  ],
});

const createTestPositions = (): Record<string, Position> => ({
  node1: { x: 100, y: 100 },
  node2: { x: 200, y: 150 },
  node3: { x: 300, y: 200 },
});

describe('createGraphView', () => {
  it('should create a GraphView instance', () => {
    const elements = createTestElements();
    const positions = createTestPositions();

    const graphView = createGraphView({
      elements,
      positions,
    });

    expect(graphView).toBeDefined();
    expect(typeof graphView.init).toBe('function');
    expect(typeof graphView.update).toBe('function');
    expect(typeof graphView.destroy).toBe('function');
  });

  it('should not be initialized before init() is called', () => {
    const elements = createTestElements();
    const positions = createTestPositions();

    const graphView = createGraphView({
      elements,
      positions,
    });

    expect(graphView.isInitialized()).toBe(false);
  });
});

describe('GraphView initialization', () => {
  let graphView: GraphView;
  let container: null;

  beforeEach(() => {
    container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();

    graphView = createGraphView({
      elements,
      positions,
    });
  });

  afterEach(() => {
    if (graphView && graphView.isInitialized()) {
      graphView.destroy();
    }
  });

  it('should initialize with container element', () => {
    graphView.init(container);
    expect(graphView.isInitialized()).toBe(true);
  });

  it('should return cytoscape instance after initialization', () => {
    graphView.init(container);
    const cy = graphView.getCytoscape();
    expect(cy).toBeDefined();
  });
});

describe('GraphView lens controls', () => {
  let graphView: GraphView;
  let container: null;

  beforeEach(() => {
    container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();

    graphView = createGraphView({
      elements,
      positions,
    });
    graphView.init(container);
  });

  afterEach(() => {
    if (graphView && graphView.isInitialized()) {
      graphView.destroy();
    }
  });

  it('should have default lens configuration', () => {
    const lens = graphView.getLens();
    expect(lens).toEqual(DEFAULT_LENS_CONFIG);
  });

  it('should update lens configuration', () => {
    const newLens: LensConfig = {
      edgeKinds: ['calls'],
      minConfidence: 0.5,
      showPatterns: false,
    };
    graphView.setLens(newLens);
    expect(graphView.getLens()).toEqual(newLens);
  });
});

describe('GraphView zoom and pan', () => {
  let graphView: GraphView;
  let container: null;

  beforeEach(() => {
    container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();

    graphView = createGraphView({
      elements,
      positions,
    });
    graphView.init(container);
  });

  afterEach(() => {
    if (graphView && graphView.isInitialized()) {
      graphView.destroy();
    }
  });

  it('should get current zoom level', () => {
    const zoom = graphView.getZoom();
    expect(typeof zoom).toBe('number');
    expect(zoom).toBeGreaterThan(0);
  });

  it('should set zoom level', () => {
    graphView.setZoom(1.5);
    const zoom = graphView.getZoom();
    expect(zoom).toBeCloseTo(1.5, 1);
  });

  it('should fit to view without error', () => {
    expect(() => graphView.fitToView()).not.toThrow();
  });

  it('should center on node without error', () => {
    expect(() => graphView.centerOnNode('node1')).not.toThrow();
  });
});

describe('GraphView expand/collapse', () => {
  let graphView: GraphView;
  let container: null;

  beforeEach(() => {
    container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();

    graphView = createGraphView({
      elements,
      positions,
    });
    graphView.init(container);
  });

  afterEach(() => {
    if (graphView && graphView.isInitialized()) {
      graphView.destroy();
    }
  });

  it('should track expanded nodes', () => {
    const expanded = graphView.getExpandedNodes();
    expect(expanded).toBeInstanceOf(Set);
  });

  it('should track collapsed nodes', () => {
    const collapsed = graphView.getCollapsedNodes();
    expect(collapsed).toBeInstanceOf(Set);
  });

  it('should expand a node', async () => {
    await graphView.expandNode('node1');
    const expanded = graphView.getExpandedNodes();
    expect(expanded.has('node1')).toBe(true);
  });

  it('should collapse a node', async () => {
    await graphView.expandNode('node1');
    graphView.collapseNode('node1');
    const expanded = graphView.getExpandedNodes();
    const collapsed = graphView.getCollapsedNodes();
    expect(expanded.has('node1')).toBe(false);
    expect(collapsed.has('node1')).toBe(true);
  });
});

describe('GraphView pattern highlighting', () => {
  let graphView: GraphView;
  let container: null;

  beforeEach(() => {
    container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();
    const patterns = [
      {
        instanceId: 'pattern-1',
        patternId: 'observer',
        roles: { subject: 'node1', observer: 'node2' },
        confidence: 0.9,
        evidence: ['calls'],
      },
    ];

    graphView = createGraphView({
      elements,
      positions,
      patterns,
    });
    graphView.init(container);
  });

  afterEach(() => {
    if (graphView && graphView.isInitialized()) {
      graphView.destroy();
    }
  });

  it('should highlight a pattern without error', () => {
    expect(() => graphView.highlightPattern('pattern-1')).not.toThrow();
  });

  it('should clear highlighting without error', () => {
    graphView.highlightPattern('pattern-1');
    expect(() => graphView.clearHighlight()).not.toThrow();
  });
});

describe('GraphView update', () => {
  let graphView: GraphView;
  let container: null;

  beforeEach(() => {
    container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();

    graphView = createGraphView({
      elements,
      positions,
    });
    graphView.init(container);
  });

  afterEach(() => {
    if (graphView && graphView.isInitialized()) {
      graphView.destroy();
    }
  });

  it('should update elements', () => {
    const newElements: CytoscapeElements = {
      nodes: [{ data: { id: 'newNode', label: 'New', kind: 'class' }, classes: 'node-class' }],
      edges: [],
    };
    expect(() => graphView.update({ elements: newElements })).not.toThrow();
  });

  it('should update positions', () => {
    const newPositions: Record<string, Position> = {
      node1: { x: 500, y: 500 },
    };
    expect(() => graphView.update({ positions: newPositions })).not.toThrow();
  });
});

describe('GraphView export', () => {
  let graphView: GraphView;
  let container: null;

  beforeEach(() => {
    container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();

    graphView = createGraphView({
      elements,
      positions,
    });
    graphView.init(container);
  });

  afterEach(() => {
    if (graphView && graphView.isInitialized()) {
      graphView.destroy();
    }
  });

  it('should export PNG (returns empty blob in headless mode)', async () => {
    // In headless mode, Cytoscape cannot render images
    // Our implementation returns an empty blob gracefully
    const blob = await graphView.exportPNG();
    expect(blob).toBeInstanceOf(Blob);
  });

  it('should export SVG (returns empty string in headless mode)', () => {
    // In headless mode, SVG export is not available
    // Our implementation returns empty string gracefully
    const svg = graphView.exportSVG();
    expect(typeof svg).toBe('string');
  });
});

describe('GraphView destruction', () => {
  it('should destroy cleanly', () => {
    const container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();

    const graphView = createGraphView({
      elements,
      positions,
    });
    graphView.init(container);
    expect(graphView.isInitialized()).toBe(true);

    graphView.destroy();
    expect(graphView.isInitialized()).toBe(false);
  });

  it('should allow re-initialization after destroy', () => {
    const container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();

    const graphView = createGraphView({
      elements,
      positions,
    });
    graphView.init(container);
    graphView.destroy();
    graphView.init(container);
    expect(graphView.isInitialized()).toBe(true);
    graphView.destroy();
  });
});

describe('GraphView callbacks', () => {
  it('should accept onNodeClick callback', () => {
    const container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();
    const onNodeClick = vi.fn();

    const graphView = createGraphView({
      elements,
      positions,
      onNodeClick,
    });
    graphView.init(container);
    expect(graphView.isInitialized()).toBe(true);
    graphView.destroy();
  });

  it('should accept onNodeExpand callback', () => {
    const container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();
    const onNodeExpand = vi.fn();

    const graphView = createGraphView({
      elements,
      positions,
      onNodeExpand,
    });
    graphView.init(container);
    expect(graphView.isInitialized()).toBe(true);
    graphView.destroy();
  });

  it('should accept onEdgeClick callback', () => {
    const container = createMockContainer();
    const elements = createTestElements();
    const positions = createTestPositions();
    const onEdgeClick = vi.fn();

    const graphView = createGraphView({
      elements,
      positions,
      onEdgeClick,
    });
    graphView.init(container);
    expect(graphView.isInitialized()).toBe(true);
    graphView.destroy();
  });
});

describe('GraphView with large graphs', () => {
  it('should handle 500+ nodes without error', () => {
    const container = createMockContainer();
    const nodes = [];
    const edges = [];
    const positions: Record<string, Position> = {};

    for (let i = 0; i < 500; i++) {
      nodes.push({
        data: { id: `node${i}`, label: `Node ${i}`, kind: 'class' as const },
        classes: 'node-class',
      });
      positions[`node${i}`] = { x: (i % 20) * 50, y: Math.floor(i / 20) * 50 };

      if (i > 0) {
        edges.push({
          data: {
            id: `edge${i}`,
            source: `node${i - 1}`,
            target: `node${i}`,
            kind: 'calls' as const,
            confidence: 0.8,
          },
          classes: 'edge-calls',
        });
      }
    }

    const elements: CytoscapeElements = { nodes, edges };

    const graphView = createGraphView({
      elements,
      positions,
    });

    expect(() => graphView.init(container)).not.toThrow();
    expect(graphView.isInitialized()).toBe(true);
    graphView.destroy();
  });
});
