# P5: Visualization

> **Control Plane**: This phase is orchestrated by Claude Code with the ai-dev-kit plugin.
> Execute lanes: `/ai-dev-kit:execute-lane plans/P5-visualization.md SL-GRAPH`
> Execute phase: `/ai-dev-kit:execute-phase plans/P5-visualization.md`
> Delegate tasks: `/ai-dev-kit:delegate cursor "Generate pattern hull rendering"`

---

## Summary

Phase 5 implements the interactive Visualization layer for Semantic Lens:

1. **Cytoscape Graph Component** - Wrapper component for Cytoscape.js with node/edge styling, zoom/pan controls, and compound node support
2. **Lens Controls** - Edge kind toggles, confidence slider filter, and pattern visibility toggles
3. **Pattern Overlay Visualization** - Convex hulls/highlights for pattern participants with pattern list panel navigation
4. **Expand/Collapse Interaction** - Node expansion/collapse with automatic layout updates

This phase builds on the View Service API (Phase 4) to provide the complete frontend visualization experience.

---

## Interface Freeze Gates

### Core Interfaces (IF-0)
- [ ] IF-0-P5-GRAPHVIEW: GraphView component interface and props
- [ ] IF-0-P5-CONTROLS: GraphControls interface for lens and interaction control
- [ ] IF-0-P5-OVERLAYS: PatternOverlay interface for hull/highlight rendering
- [ ] IF-0-P5-PANELS: LensPanel and PatternPanel component interfaces

### Dependencies from Previous Phases
- [x] IF-0-P4-VIEWCONFIG: ViewConfig type and view registry (from Phase 4)
- [x] IF-0-P4-FORMATTER: CytoscapeFormatter interface (from Phase 4)
- [x] IF-0-P4-LAYOUT: ELKLayoutEngine interface (from Phase 4)
- [x] IF-0-P4-API: HTTP API endpoints specification (from Phase 4)

---

## Lane Index & Dependencies

```
- SL-GRAPH -- Cytoscape Graph Component
  - Depends on: IF-0-P5-GRAPHVIEW
  - Blocks: SL-CONTROLS
  - Parallel-safe: yes

- SL-CONTROLS -- Controls & Overlays
  - Depends on: SL-GRAPH, IF-0-P5-CONTROLS, IF-0-P5-OVERLAYS, IF-0-P5-PANELS
  - Blocks: none
  - Parallel-safe: no (depends on SL-GRAPH)
```

---

## A. Architectural Baseline & Component Catalog

### Files to Add

| Path | Purpose | Owner |
|------|---------|-------|
| `src/ui/types.ts` | UI-specific types and interfaces | SL-GRAPH |
| `src/ui/graph/graph-view.ts` | Cytoscape wrapper component | SL-GRAPH |
| `src/ui/graph/styles.ts` | Cytoscape stylesheet definitions | SL-GRAPH |
| `src/ui/graph/index.ts` | Graph component exports | SL-GRAPH |
| `src/ui/controls/lens-panel.ts` | Lens control panel component | SL-CONTROLS |
| `src/ui/controls/pattern-panel.ts` | Pattern list and navigation panel | SL-CONTROLS |
| `src/ui/controls/index.ts` | Controls exports | SL-CONTROLS |
| `src/ui/overlays/pattern-overlay.ts` | Pattern visualization overlays | SL-CONTROLS |
| `src/ui/overlays/index.ts` | Overlays exports | SL-CONTROLS |
| `src/ui/index.ts` | Main UI module exports | SL-CONTROLS |

### Files to Modify

| Path | Change | Owner |
|------|--------|-------|
| `package.json` | Add cytoscape dependency | SL-GRAPH |

### Test Files to Add

| Path | Purpose | Owner |
|------|---------|-------|
| `tests/unit/ui/types.test.ts` | UI type validation tests | SL-GRAPH |
| `tests/unit/ui/graph-view.test.ts` | Graph component tests | SL-GRAPH |
| `tests/unit/ui/styles.test.ts` | Stylesheet generation tests | SL-GRAPH |
| `tests/unit/ui/lens-panel.test.ts` | Lens panel tests | SL-CONTROLS |
| `tests/unit/ui/pattern-panel.test.ts` | Pattern panel tests | SL-CONTROLS |
| `tests/unit/ui/pattern-overlay.test.ts` | Pattern overlay tests | SL-CONTROLS |

---

## B. Code-Level Interface Contracts

### UI Types (src/ui/types.ts)

```typescript
import type { EdgeKind, NodeKind } from '../constants.js';
import type { CytoscapeElements, CytoscapeNode } from '../view-service/formatter/formatter.js';
import type { Position } from '../view-service/types.js';
import type { PatternMatch } from '../patterns/types.js';

/**
 * Props for the GraphView component.
 */
export interface GraphViewProps {
  /** Cytoscape elements to render */
  elements: CytoscapeElements;
  /** Node positions from layout engine */
  positions: Record<string, Position>;
  /** Pattern matches to overlay (optional) */
  patterns?: PatternMatch[];
  /** Callback when a node is clicked */
  onNodeClick?: (nodeId: string, node: CytoscapeNode) => void;
  /** Callback when a node is double-clicked for expansion */
  onNodeExpand?: (nodeId: string) => void;
  /** Callback when a node is collapsed */
  onNodeCollapse?: (nodeId: string) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (edgeId: string) => void;
  /** Whether to enable user zoom/pan (default: true) */
  interactive?: boolean;
  /** Container element ID or ref */
  container?: string | HTMLElement;
}

/**
 * Lens configuration for filtering displayed elements.
 */
export interface LensConfig {
  /** Edge kinds to display */
  edgeKinds: EdgeKind[];
  /** Minimum confidence threshold (0-1) */
  minConfidence: number;
  /** Whether to show pattern overlays */
  showPatterns: boolean;
  /** Specific pattern IDs to show (empty = all) */
  patternFilter?: string[];
  /** Node kinds to show (empty = all) */
  nodeKinds?: NodeKind[];
}

/**
 * Default lens configuration.
 */
export const DEFAULT_LENS_CONFIG: LensConfig = {
  edgeKinds: ['calls', 'inherits', 'implements', 'defines', 'imports', 'uses', 'reads', 'writes', 'throws'],
  minConfidence: 0.0,
  showPatterns: true,
  patternFilter: [],
  nodeKinds: [],
};

/**
 * Interface for controlling the graph view.
 */
export interface GraphControls {
  /** Apply a lens configuration to filter elements */
  setLens(config: LensConfig): void;
  /** Get the current lens configuration */
  getLens(): LensConfig;
  /** Expand a collapsed node to show its children */
  expandNode(nodeId: string): Promise<void>;
  /** Collapse a node to hide its children */
  collapseNode(nodeId: string): void;
  /** Highlight nodes in a specific pattern */
  highlightPattern(instanceId: string): void;
  /** Clear pattern highlighting */
  clearHighlight(): void;
  /** Fit the graph to the viewport */
  fitToView(): void;
  /** Center on a specific node */
  centerOnNode(nodeId: string): void;
  /** Export the current view as a PNG blob */
  exportPNG(): Promise<Blob>;
  /** Export the current view as SVG string */
  exportSVG(): string;
  /** Get the current zoom level */
  getZoom(): number;
  /** Set the zoom level */
  setZoom(level: number): void;
  /** Get the set of expanded node IDs */
  getExpandedNodes(): Set<string>;
  /** Get the set of collapsed node IDs */
  getCollapsedNodes(): Set<string>;
}

/**
 * Props for the LensPanel component.
 */
export interface LensPanelProps {
  /** Current lens configuration */
  config: LensConfig;
  /** Callback when lens configuration changes */
  onChange: (config: LensConfig) => void;
  /** Available edge kinds to toggle */
  availableEdgeKinds: EdgeKind[];
  /** Available node kinds to toggle */
  availableNodeKinds: NodeKind[];
}

/**
 * Props for the PatternPanel component.
 */
export interface PatternPanelProps {
  /** Pattern matches to display */
  patterns: PatternMatch[];
  /** Currently highlighted pattern instance ID */
  highlightedPattern?: string;
  /** Callback when a pattern is selected */
  onPatternSelect: (instanceId: string) => void;
  /** Callback when highlighting is cleared */
  onClearHighlight: () => void;
  /** Whether to group patterns by pattern ID */
  groupByPattern?: boolean;
}

/**
 * Pattern overlay configuration.
 */
export interface PatternOverlayConfig {
  /** Pattern matches to visualize */
  patterns: PatternMatch[];
  /** Style for convex hulls */
  hullStyle?: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
  };
  /** Whether to show labels on hulls */
  showLabels?: boolean;
  /** Highlighted pattern instance ID */
  highlightedInstance?: string;
}

/**
 * Validate LensConfig.
 */
export function isValidLensConfig(config: unknown): config is LensConfig;

/**
 * Apply lens filter to elements.
 */
export function applyLensFilter(
  elements: CytoscapeElements,
  config: LensConfig
): CytoscapeElements;
```

### GraphView Component (src/ui/graph/graph-view.ts)

```typescript
import type { GraphViewProps, GraphControls, LensConfig } from '../types.js';

/**
 * Create and manage a Cytoscape graph view.
 */
export interface GraphView extends GraphControls {
  /** Initialize the graph in a container */
  init(container: HTMLElement | string): void;
  /** Update the graph with new elements */
  update(props: Partial<GraphViewProps>): void;
  /** Destroy the graph instance */
  destroy(): void;
  /** Get the underlying Cytoscape instance (for advanced usage) */
  getCytoscape(): unknown;
  /** Check if the graph is initialized */
  isInitialized(): boolean;
}

/**
 * Create a new GraphView instance.
 */
export function createGraphView(props: GraphViewProps): GraphView;
```

### Cytoscape Styles (src/ui/graph/styles.ts)

```typescript
import type { NodeKind, EdgeKind } from '../../constants.js';

/**
 * Cytoscape stylesheet definition.
 */
export interface CytoscapeStyle {
  selector: string;
  style: Record<string, unknown>;
}

/**
 * Get the default stylesheet for the graph.
 */
export function getDefaultStylesheet(): CytoscapeStyle[];

/**
 * Get color for a node kind.
 */
export function getNodeKindColor(kind: NodeKind): string;

/**
 * Get color for an edge kind.
 */
export function getEdgeKindColor(kind: EdgeKind): string;

/**
 * Get styles for pattern overlay.
 */
export function getPatternOverlayStyles(): CytoscapeStyle[];

/**
 * Get styles for highlighted elements.
 */
export function getHighlightStyles(): CytoscapeStyle[];
```

### Lens Panel (src/ui/controls/lens-panel.ts)

```typescript
import type { LensPanelProps, LensConfig } from '../types.js';
import type { EdgeKind, NodeKind } from '../../constants.js';

/**
 * Lens panel controller interface.
 */
export interface LensPanel {
  /** Render the panel to a container */
  render(container: HTMLElement): void;
  /** Update the panel state */
  update(props: Partial<LensPanelProps>): void;
  /** Get the current configuration */
  getConfig(): LensConfig;
  /** Destroy the panel */
  destroy(): void;
}

/**
 * Create a lens panel controller.
 */
export function createLensPanel(props: LensPanelProps): LensPanel;

/**
 * Generate HTML for edge kind toggles.
 */
export function renderEdgeKindToggles(
  kinds: EdgeKind[],
  enabled: EdgeKind[],
  onChange: (kind: EdgeKind, enabled: boolean) => void
): string;

/**
 * Generate HTML for confidence slider.
 */
export function renderConfidenceSlider(
  value: number,
  onChange: (value: number) => void
): string;
```

### Pattern Panel (src/ui/controls/pattern-panel.ts)

```typescript
import type { PatternPanelProps, PatternMatch } from '../types.js';

/**
 * Pattern panel controller interface.
 */
export interface PatternPanel {
  /** Render the panel to a container */
  render(container: HTMLElement): void;
  /** Update the panel state */
  update(props: Partial<PatternPanelProps>): void;
  /** Get grouped patterns by pattern ID */
  getGroupedPatterns(): Map<string, PatternMatch[]>;
  /** Destroy the panel */
  destroy(): void;
}

/**
 * Create a pattern panel controller.
 */
export function createPatternPanel(props: PatternPanelProps): PatternPanel;

/**
 * Group patterns by pattern ID.
 */
export function groupPatternsByType(patterns: PatternMatch[]): Map<string, PatternMatch[]>;

/**
 * Generate pattern summary for display.
 */
export function formatPatternSummary(pattern: PatternMatch): string;
```

### Pattern Overlay (src/ui/overlays/pattern-overlay.ts)

```typescript
import type { PatternOverlayConfig } from '../types.js';
import type { PatternMatch } from '../../patterns/types.js';

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
 * Create a pattern overlay manager.
 */
export function createPatternOverlayManager(config: PatternOverlayConfig): PatternOverlayManager;

/**
 * Calculate convex hull points for a set of nodes.
 */
export function calculateConvexHull(
  nodePositions: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }>;

/**
 * Get node IDs participating in a pattern.
 */
export function getPatternNodeIds(pattern: PatternMatch): string[];
```

---

## C. Exhaustive Change List

| File | Status | Owner | Rationale |
|------|--------|-------|-----------|
| `src/ui/types.ts` | Added | SL-GRAPH | Core UI type definitions |
| `src/ui/graph/graph-view.ts` | Added | SL-GRAPH | Cytoscape wrapper component |
| `src/ui/graph/styles.ts` | Added | SL-GRAPH | Cytoscape stylesheet definitions |
| `src/ui/graph/index.ts` | Added | SL-GRAPH | Graph module exports |
| `src/ui/controls/lens-panel.ts` | Added | SL-CONTROLS | Lens control panel |
| `src/ui/controls/pattern-panel.ts` | Added | SL-CONTROLS | Pattern list panel |
| `src/ui/controls/index.ts` | Added | SL-CONTROLS | Controls module exports |
| `src/ui/overlays/pattern-overlay.ts` | Added | SL-CONTROLS | Pattern overlay visualization |
| `src/ui/overlays/index.ts` | Added | SL-CONTROLS | Overlays module exports |
| `src/ui/index.ts` | Added | SL-CONTROLS | Main UI exports |
| `package.json` | Modified | SL-GRAPH | Add cytoscape dependency |
| `tests/unit/ui/types.test.ts` | Added | SL-GRAPH | UI type tests |
| `tests/unit/ui/graph-view.test.ts` | Added | SL-GRAPH | Graph component tests |
| `tests/unit/ui/styles.test.ts` | Added | SL-GRAPH | Stylesheet tests |
| `tests/unit/ui/lens-panel.test.ts` | Added | SL-CONTROLS | Lens panel tests |
| `tests/unit/ui/pattern-panel.test.ts` | Added | SL-CONTROLS | Pattern panel tests |
| `tests/unit/ui/pattern-overlay.test.ts` | Added | SL-CONTROLS | Pattern overlay tests |

---

## D. Swim Lanes

### SL-GRAPH -- Cytoscape Graph Component

**Scope**:
- Create Cytoscape wrapper component with initialization and destruction
- Implement node/edge styling by kind with configurable stylesheet
- Add zoom, pan, and fit controls
- Support compound nodes for hierarchical display

**Owned Files**:
- `src/ui/types.ts`
- `src/ui/graph/graph-view.ts`
- `src/ui/graph/styles.ts`
- `src/ui/graph/index.ts`
- `tests/unit/ui/types.test.ts`
- `tests/unit/ui/graph-view.test.ts`
- `tests/unit/ui/styles.test.ts`
- `package.json` (cytoscape dependency only)

**Interfaces Provided**:
- `GraphViewProps`, `LensConfig`, `GraphControls`, `PatternOverlayConfig` (types.ts)
- `GraphView`, `createGraphView()` (graph-view.ts)
- `getDefaultStylesheet()`, `getNodeKindColor()`, `getEdgeKindColor()` (styles.ts)

**Interfaces Consumed**:
- `CytoscapeElements`, `CytoscapeNode`, `CytoscapeEdge` from `src/view-service/formatter/formatter.ts`
- `Position` from `src/view-service/types.ts`
- `PatternMatch` from `src/patterns/types.ts`
- `EdgeKind`, `NodeKind` from `src/constants.ts`

**Tasks**:

| Task ID | Task Type | Depends On | Files in Scope | Tests Owned Files | Test Command(s) | Acceptance Criteria |
|---------|-----------|------------|----------------|-------------------|-----------------|---------------------|
| P5-SL-GRAPH-01 | impl | - | package.json | - | npm install | cytoscape dependency added |
| P5-SL-GRAPH-02 | test | P5-SL-GRAPH-01 | - | tests/unit/ui/types.test.ts | npm test -- tests/unit/ui/types.test.ts | Tests for LensConfig validation and applyLensFilter exist |
| P5-SL-GRAPH-03 | impl | P5-SL-GRAPH-02 | src/ui/types.ts | tests/unit/ui/types.test.ts | npm test -- tests/unit/ui/types.test.ts | UI types defined with validation and filter functions |
| P5-SL-GRAPH-04 | test | P5-SL-GRAPH-03 | - | tests/unit/ui/styles.test.ts | npm test -- tests/unit/ui/styles.test.ts | Tests for stylesheet generation and colors exist |
| P5-SL-GRAPH-05 | impl | P5-SL-GRAPH-04 | src/ui/graph/styles.ts | tests/unit/ui/styles.test.ts | npm test -- tests/unit/ui/styles.test.ts | Stylesheet functions return valid Cytoscape styles |
| P5-SL-GRAPH-06 | test | P5-SL-GRAPH-05 | - | tests/unit/ui/graph-view.test.ts | npm test -- tests/unit/ui/graph-view.test.ts | Tests for GraphView init, update, controls exist |
| P5-SL-GRAPH-07 | impl | P5-SL-GRAPH-06 | src/ui/graph/graph-view.ts, src/ui/graph/index.ts | tests/unit/ui/graph-view.test.ts | npm test -- tests/unit/ui/graph-view.test.ts | GraphView component fully functional |
| P5-SL-GRAPH-08 | verify | P5-SL-GRAPH-07 | - | tests/unit/ui/graph-view.test.ts | npm test -- tests/unit/ui | All SL-GRAPH tests pass |

---

### SL-CONTROLS -- Controls & Overlays

**Scope**:
- Build lens controls with edge kind toggles and confidence slider
- Implement pattern overlay visualization with convex hulls
- Create pattern list panel with navigation
- Add expand/collapse node interaction

**Owned Files**:
- `src/ui/controls/lens-panel.ts`
- `src/ui/controls/pattern-panel.ts`
- `src/ui/controls/index.ts`
- `src/ui/overlays/pattern-overlay.ts`
- `src/ui/overlays/index.ts`
- `src/ui/index.ts`
- `tests/unit/ui/lens-panel.test.ts`
- `tests/unit/ui/pattern-panel.test.ts`
- `tests/unit/ui/pattern-overlay.test.ts`

**Interfaces Provided**:
- `LensPanel`, `createLensPanel()` (lens-panel.ts)
- `PatternPanel`, `createPatternPanel()`, `groupPatternsByType()` (pattern-panel.ts)
- `PatternOverlayManager`, `createPatternOverlayManager()`, `calculateConvexHull()` (pattern-overlay.ts)

**Interfaces Consumed**:
- `LensConfig`, `LensPanelProps`, `PatternPanelProps`, `PatternOverlayConfig` from `src/ui/types.ts`
- `PatternMatch` from `src/patterns/types.ts`
- `EdgeKind`, `NodeKind` from `src/constants.ts`

**Tasks**:

| Task ID | Task Type | Depends On | Files in Scope | Tests Owned Files | Test Command(s) | Acceptance Criteria |
|---------|-----------|------------|----------------|-------------------|-----------------|---------------------|
| P5-SL-CONTROLS-01 | test | P5-SL-GRAPH-08 | - | tests/unit/ui/lens-panel.test.ts | npm test -- tests/unit/ui/lens-panel.test.ts | Tests for lens panel rendering and config changes |
| P5-SL-CONTROLS-02 | impl | P5-SL-CONTROLS-01 | src/ui/controls/lens-panel.ts | tests/unit/ui/lens-panel.test.ts | npm test -- tests/unit/ui/lens-panel.test.ts | LensPanel renders and updates correctly |
| P5-SL-CONTROLS-03 | test | P5-SL-CONTROLS-02 | - | tests/unit/ui/pattern-panel.test.ts | npm test -- tests/unit/ui/pattern-panel.test.ts | Tests for pattern panel rendering and selection |
| P5-SL-CONTROLS-04 | impl | P5-SL-CONTROLS-03 | src/ui/controls/pattern-panel.ts, src/ui/controls/index.ts | tests/unit/ui/pattern-panel.test.ts | npm test -- tests/unit/ui/pattern-panel.test.ts | PatternPanel renders with grouping and selection |
| P5-SL-CONTROLS-05 | test | P5-SL-CONTROLS-04 | - | tests/unit/ui/pattern-overlay.test.ts | npm test -- tests/unit/ui/pattern-overlay.test.ts | Tests for overlay rendering and hull calculation |
| P5-SL-CONTROLS-06 | impl | P5-SL-CONTROLS-05 | src/ui/overlays/pattern-overlay.ts, src/ui/overlays/index.ts | tests/unit/ui/pattern-overlay.test.ts | npm test -- tests/unit/ui/pattern-overlay.test.ts | PatternOverlayManager applies hulls correctly |
| P5-SL-CONTROLS-07 | impl | P5-SL-CONTROLS-06 | src/ui/index.ts | - | npm run build | Main UI module exports all components |
| P5-SL-CONTROLS-08 | verify | P5-SL-CONTROLS-07 | - | tests/unit/ui/*.test.ts | npm test -- tests/unit/ui && npm run build | All UI tests pass and project builds |

---

## E. Execution Notes

### Parallelization Strategy

```
Phase Start
    |
    v
SL-GRAPH (tasks 01-08)
    |
    v
SL-CONTROLS (tasks 01-08)
    |
    v
Phase Complete
```

- **SL-GRAPH** runs first to establish UI types and graph component
- **SL-CONTROLS** must wait for SL-GRAPH to complete (depends on types and graph component)
- Within each lane, tasks are sequential (test -> impl -> verify)

### Serialization Points

1. `src/ui/types.ts` must be created before SL-CONTROLS can start
2. `src/ui/graph/graph-view.ts` must exist for overlay integration
3. `package.json` modification happens early in SL-GRAPH

### Unblocking Deliverables

1. **types.ts** - Unblocks all UI components (shared type definitions)
2. **cytoscape dependency** - Unblocks graph component implementation
3. **graph-view.ts** - Unblocks overlay and control integration

---

## F. File-by-File Specification

### `src/ui/types.ts` -- added -- Owner: SL-GRAPH

**Purpose**: Define all UI-related types and interfaces.

**Key Responsibilities**:
- Export GraphViewProps, LensConfig, GraphControls interfaces
- Export PatternOverlayConfig and panel props
- Provide LensConfig validation function
- Provide applyLensFilter function for element filtering

**Interfaces Exposed**:
- `GraphViewProps` - Props for graph component
- `LensConfig` - Lens filter configuration
- `GraphControls` - Control interface for graph
- `PatternOverlayConfig` - Overlay configuration
- `LensPanelProps` - Props for lens panel
- `PatternPanelProps` - Props for pattern panel

**Tests Required**:
- LensConfig validation with all fields
- applyLensFilter correctly filters by edge kind
- applyLensFilter correctly filters by confidence
- DEFAULT_LENS_CONFIG has valid values

---

### `src/ui/graph/graph-view.ts` -- added -- Owner: SL-GRAPH

**Purpose**: Cytoscape.js wrapper component for graph visualization.

**Key Responsibilities**:
- Initialize Cytoscape instance in container
- Apply elements and positions from props
- Implement all GraphControls methods
- Handle node click, expand, collapse events
- Manage lifecycle (init, update, destroy)
- Support compound nodes for hierarchical display

**Interfaces Exposed**:
- `GraphView` - Extended GraphControls interface
- `createGraphView()` - Factory function

**Tests Required**:
- Initialization in container element
- Update with new elements
- Lens application filters elements
- Expand/collapse node interactions
- Zoom, pan, fit controls
- Export PNG/SVG
- Destruction cleanup

---

### `src/ui/graph/styles.ts` -- added -- Owner: SL-GRAPH

**Purpose**: Cytoscape stylesheet definitions for consistent styling.

**Key Responsibilities**:
- Define base styles for nodes and edges
- Map node kinds to colors and shapes
- Map edge kinds to colors and line styles
- Define pattern overlay and highlight styles
- Support dark/light theme (optional)

**Interfaces Exposed**:
- `CytoscapeStyle` - Style definition type
- `getDefaultStylesheet()` - Full stylesheet
- `getNodeKindColor()` - Color mapping
- `getEdgeKindColor()` - Color mapping
- `getPatternOverlayStyles()` - Overlay styles
- `getHighlightStyles()` - Highlight styles

**Tests Required**:
- Default stylesheet has all required selectors
- All node kinds have colors
- All edge kinds have colors
- Pattern styles include hull styling
- Highlight styles differ from normal

---

### `src/ui/controls/lens-panel.ts` -- added -- Owner: SL-CONTROLS

**Purpose**: Control panel for lens configuration.

**Key Responsibilities**:
- Render edge kind toggles
- Render confidence slider
- Render pattern visibility toggle
- Handle config changes and notify parent
- Support dynamic available kinds

**Interfaces Exposed**:
- `LensPanel` - Panel controller interface
- `createLensPanel()` - Factory function
- `renderEdgeKindToggles()` - Toggle HTML generator
- `renderConfidenceSlider()` - Slider HTML generator

**Tests Required**:
- Panel renders all edge kind toggles
- Toggle changes update config
- Confidence slider updates config
- Pattern toggle works correctly

---

### `src/ui/controls/pattern-panel.ts` -- added -- Owner: SL-CONTROLS

**Purpose**: Panel for listing and navigating pattern matches.

**Key Responsibilities**:
- Render list of pattern matches
- Group patterns by pattern ID
- Handle pattern selection
- Display pattern confidence and roles
- Highlight selected pattern

**Interfaces Exposed**:
- `PatternPanel` - Panel controller interface
- `createPatternPanel()` - Factory function
- `groupPatternsByType()` - Grouping utility
- `formatPatternSummary()` - Display formatter

**Tests Required**:
- Panel renders pattern list
- Grouping by pattern ID works
- Selection triggers callback
- Summary format is readable
- Clear highlight works

---

### `src/ui/overlays/pattern-overlay.ts` -- added -- Owner: SL-CONTROLS

**Purpose**: Pattern visualization with convex hulls and highlights.

**Key Responsibilities**:
- Calculate convex hull for pattern node positions
- Render hull overlay on Cytoscape
- Handle highlight/unhighlight
- Support multiple concurrent patterns
- Configure hull styling

**Interfaces Exposed**:
- `PatternOverlayManager` - Manager interface
- `createPatternOverlayManager()` - Factory function
- `calculateConvexHull()` - Hull calculation
- `getPatternNodeIds()` - Node extraction

**Tests Required**:
- Convex hull calculation for various shapes
- Overlay applies to Cytoscape
- Highlight changes overlay appearance
- Clear removes all overlays
- Pattern node extraction works

---

## H. Test Execution Plan

### Test Commands by Lane

```bash
# SL-GRAPH tests
npm test -- tests/unit/ui/types.test.ts
npm test -- tests/unit/ui/styles.test.ts
npm test -- tests/unit/ui/graph-view.test.ts

# SL-CONTROLS tests
npm test -- tests/unit/ui/lens-panel.test.ts
npm test -- tests/unit/ui/pattern-panel.test.ts
npm test -- tests/unit/ui/pattern-overlay.test.ts

# Full UI suite
npm test -- tests/unit/ui

# Full project suite
npm test

# Build verification
npm run build
```

### Test Ordering Constraints

1. Run type tests first (no dependencies)
2. Run style tests after types
3. Run graph-view tests after styles
4. Run control tests after graph component
5. Run overlay tests after controls
6. Full suite validates everything works together
7. Build validates TypeScript compilation

### Smoke Tests

- `npm test -- tests/unit/ui/types.test.ts` - Validates types compile
- `npm run build` - Validates TypeScript compilation

---

## J. Acceptance Criteria

| Criterion | Test | Pass Condition |
|-----------|------|----------------|
| Graph renders with correct styling for all node/edge kinds | graph-view.test.ts, styles.test.ts | All node kinds have distinct colors, all edge kinds styled |
| Lenses correctly filter displayed elements | types.test.ts, graph-view.test.ts | applyLensFilter removes elements below confidence or wrong edge kind |
| Pattern overlays highlight participating nodes | pattern-overlay.test.ts | Nodes in pattern get overlay class and hull |
| Expand/collapse works smoothly | graph-view.test.ts | expandNode/collapseNode modify visible elements |
| UI is responsive and handles 500+ visible nodes | graph-view.test.ts | No errors with large element sets |
| Convex hull calculation is correct | pattern-overlay.test.ts | Hull contains all points, no concave sections |
| Lens panel updates graph filter | lens-panel.test.ts | Config changes propagate to graph |
| Pattern panel allows navigation | pattern-panel.test.ts | Selection highlights correct pattern |
| npm run build succeeds | build command | Zero TypeScript errors |
| npm test passes | test command | All tests pass with >80% coverage on UI module |

---

## Output Validation Checklist

### Structure
- [x] Document has correct `# P5: Visualization` heading
- [x] All required sections (A through J) are present
- [x] Lane Index & Dependencies section is machine-parseable

### Gates
- [x] All interface contracts have `IF-*` gates
- [x] Gate IDs follow naming convention

### Lanes
- [x] Each lane has unique ID (SL-GRAPH, SL-CONTROLS)
- [x] Each lane has explicit file ownership
- [x] No unresolved file overlaps
- [x] Dependencies form a DAG (no cycles)

### Tasks
- [x] Each task has Task ID, Task Type, Depends On
- [x] Each task has Tests owned files and Test command(s)
- [x] Task ordering: test -> impl -> verify
- [x] No task modifies files outside its lane

### Acceptance Criteria
- [x] All criteria are testable (not subjective)
- [x] Each criterion maps to specific tests
- [x] No unverifiable "should be good" criteria
