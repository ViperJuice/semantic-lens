# P4: View Service

> **Control Plane**: This phase is orchestrated by Claude Code with the ai-dev-kit plugin.
> Execute lanes: `/ai-dev-kit:execute-lane plans/P4-view-service.md SL-PROJ`
> Execute phase: `/ai-dev-kit:execute-phase plans/P4-view-service.md`
> Delegate tasks: `/ai-dev-kit:delegate cursor "Generate Cytoscape element formatter"`

---

## Summary

Phase 4 implements the View Service layer for Semantic Lens:

1. **Graph Projector** - View-specific subgraph extraction with filtering by edge kinds, confidence, and depth-bounded traversal
2. **ELK Layout Integration** - Deterministic graph layout via elkjs with incremental component layout
3. **Cytoscape Formatter** - Converts graph data to Cytoscape.js-compatible elements
4. **HTTP API Server** - Express-based REST API for view requests, layout computation, and pattern runs

This phase builds on the GraphStore (Phase 2) and PatternMatcher (Phase 3) to provide the visualization backend.

---

## Interface Freeze Gates

### Core Interfaces (IF-0)
- [ ] IF-0-P4-VIEWCONFIG: ViewConfig type and view registry
- [ ] IF-0-P4-PROJECTOR: GraphProjector interface and projector factory
- [ ] IF-0-P4-FORMATTER: CytoscapeFormatter interface
- [ ] IF-0-P4-LAYOUT: ELKLayoutEngine interface
- [ ] IF-0-P4-API: HTTP API endpoints specification

### Dependencies from Previous Phases
- [x] IF-0-P2-GRAPHSTORE: GraphStore interface (from Phase 2)
- [x] IF-0-P3-MATCHER: PatternMatcher interface (from Phase 3)

---

## Lane Index & Dependencies

```
- SL-PROJ -- Graph Projector
  - Depends on: IF-0-P4-VIEWCONFIG
  - Blocks: SL-API
  - Parallel-safe: yes

- SL-LAYOUT -- ELK Layout Integration
  - Depends on: IF-0-P4-VIEWCONFIG
  - Blocks: SL-API
  - Parallel-safe: yes

- SL-API -- API Server & Formatting
  - Depends on: SL-PROJ, SL-LAYOUT
  - Blocks: none
  - Parallel-safe: no (depends on other lanes)
```

---

## A. Architectural Baseline & Component Catalog

### Files to Add

| Path | Purpose | Owner |
|------|---------|-------|
| `src/view-service/types.ts` | View types and configurations | SL-PROJ |
| `src/view-service/projector/projector.ts` | Graph projection logic | SL-PROJ |
| `src/view-service/projector/index.ts` | Projector exports | SL-PROJ |
| `src/view-service/layout/elk-client.ts` | ELK layout integration | SL-LAYOUT |
| `src/view-service/layout/index.ts` | Layout exports | SL-LAYOUT |
| `src/view-service/formatter/formatter.ts` | Cytoscape element formatting | SL-API |
| `src/view-service/formatter/index.ts` | Formatter exports | SL-API |
| `src/view-service/api/server.ts` | HTTP server and routes | SL-API |
| `src/view-service/api/index.ts` | API exports | SL-API |
| `src/view-service/index.ts` | View service main exports | SL-API |

### Files to Modify

| Path | Change | Owner |
|------|--------|-------|
| `package.json` | Add elkjs, express, cors dependencies | SL-LAYOUT |

### Test Files to Add

| Path | Purpose | Owner |
|------|---------|-------|
| `tests/unit/view-service/types.test.ts` | ViewConfig validation tests | SL-PROJ |
| `tests/unit/view-service/projector.test.ts` | Projector logic tests | SL-PROJ |
| `tests/unit/view-service/elk-client.test.ts` | ELK layout tests | SL-LAYOUT |
| `tests/unit/view-service/formatter.test.ts` | Cytoscape formatter tests | SL-API |
| `tests/unit/view-service/server.test.ts` | API endpoint tests | SL-API |

---

## B. Code-Level Interface Contracts

### ViewConfig (src/view-service/types.ts)

```typescript
/** Available view types */
export type ViewType = 'call_graph' | 'inheritance' | 'module_deps' | 'full';

/** Configuration for a graph view request */
export interface ViewConfig {
  /** Type of view to generate */
  view: ViewType;
  /** Root node ID for subgraph extraction (optional) */
  root_id?: string;
  /** Maximum traversal depth (default: 3) */
  depth?: number;
  /** Edge kinds to include (default: all) */
  edge_kinds?: EdgeKind[];
  /** Minimum confidence threshold (default: 0.0) */
  min_confidence?: number;
  /** Node kinds to collapse (group children under parent) */
  collapse_kinds?: NodeKind[];
  /** File path patterns to exclude */
  exclude_paths?: string[];
}

/** Result of a view projection */
export interface ProjectionResult {
  nodes: Node[];
  edges: Edge[];
  rootId?: string;
}

/** Complete view response with layout */
export interface ViewResponse {
  elements: CytoscapeElements;
  positions: Record<string, Position>;
  patterns?: PatternMatch[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    layoutTimeMs: number;
  };
}

/** Position coordinates */
export interface Position {
  x: number;
  y: number;
}
```

### GraphProjector (src/view-service/projector/projector.ts)

```typescript
export interface GraphProjector {
  /** Project a view from the graph store */
  project(store: GraphStore, config: ViewConfig): Promise<ProjectionResult>;

  /** Get edge kinds for a specific view type */
  getEdgeKindsForView(viewType: ViewType): EdgeKind[];
}

export function createProjector(): GraphProjector;
```

### ELKLayoutEngine (src/view-service/layout/elk-client.ts)

```typescript
export interface ELKLayoutEngine {
  /** Compute layout positions for nodes */
  layout(nodes: Node[], edges: Edge[]): Promise<Record<string, Position>>;

  /** Layout a single connected component */
  layoutComponent(nodes: Node[], edges: Edge[]): Promise<Record<string, Position>>;
}

export function createELKLayoutEngine(): ELKLayoutEngine;
```

### CytoscapeFormatter (src/view-service/formatter/formatter.ts)

```typescript
export interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    kind: NodeKind;
    file?: string;
    parent?: string;
    [key: string]: unknown;
  };
  position?: Position;
  classes?: string;
}

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

export interface CytoscapeElements {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

export interface CytoscapeFormatter {
  /** Format graph data as Cytoscape elements */
  format(nodes: Node[], edges: Edge[]): CytoscapeElements;

  /** Apply positions to elements */
  applyPositions(elements: CytoscapeElements, positions: Record<string, Position>): CytoscapeElements;

  /** Add pattern overlay classes */
  applyPatternOverlay(elements: CytoscapeElements, patterns: PatternMatch[]): CytoscapeElements;
}

export function createFormatter(): CytoscapeFormatter;
```

### HTTP API (src/view-service/api/server.ts)

```typescript
// GET /views
// Response: { views: ViewType[] }

// POST /view
// Body: ViewConfig
// Response: ViewResponse

// POST /layout/elk
// Body: { nodes: Node[], edges: Edge[] }
// Response: { positions: Record<string, Position> }

// POST /patterns/run
// Body: { scope?: string[] }
// Response: { patterns: PatternMatch[] }

export interface ViewServiceOptions {
  port?: number;
  store: GraphStore;
  matcher: PatternMatcherInterface;
}

export function createViewServer(options: ViewServiceOptions): {
  start(): Promise<void>;
  stop(): Promise<void>;
  app: Express;
};
```

---

## C. Exhaustive Change List

| File | Status | Owner | Rationale |
|------|--------|-------|-----------|
| `src/view-service/types.ts` | Added | SL-PROJ | Core type definitions for views |
| `src/view-service/projector/projector.ts` | Added | SL-PROJ | Graph projection logic |
| `src/view-service/projector/index.ts` | Added | SL-PROJ | Module exports |
| `src/view-service/layout/elk-client.ts` | Added | SL-LAYOUT | ELK layout integration |
| `src/view-service/layout/index.ts` | Added | SL-LAYOUT | Module exports |
| `src/view-service/formatter/formatter.ts` | Added | SL-API | Cytoscape formatting |
| `src/view-service/formatter/index.ts` | Added | SL-API | Module exports |
| `src/view-service/api/server.ts` | Added | SL-API | HTTP API server |
| `src/view-service/api/index.ts` | Added | SL-API | Module exports |
| `src/view-service/index.ts` | Added | SL-API | Main view-service exports |
| `package.json` | Modified | SL-LAYOUT | Add elkjs, express, cors |
| `tests/unit/view-service/types.test.ts` | Added | SL-PROJ | Type validation tests |
| `tests/unit/view-service/projector.test.ts` | Added | SL-PROJ | Projector unit tests |
| `tests/unit/view-service/elk-client.test.ts` | Added | SL-LAYOUT | ELK layout tests |
| `tests/unit/view-service/formatter.test.ts` | Added | SL-API | Formatter tests |
| `tests/unit/view-service/server.test.ts` | Added | SL-API | API endpoint tests |

---

## D. Swim Lanes

### SL-PROJ -- Graph Projector

**Scope**:
- Implement ViewConfig types and validation
- Build graph projection with depth-bounded traversal
- Filter by edge kinds, confidence, and exclusion patterns

**Owned Files**:
- `src/view-service/types.ts`
- `src/view-service/projector/projector.ts`
- `src/view-service/projector/index.ts`
- `tests/unit/view-service/types.test.ts`
- `tests/unit/view-service/projector.test.ts`

**Interfaces Provided**:
- `ViewConfig`, `ViewType`, `ProjectionResult`, `ViewResponse`, `Position` (types.ts)
- `GraphProjector`, `createProjector()` (projector.ts)

**Interfaces Consumed**:
- `GraphStore`, `SubgraphResult` from `src/graph/store.ts`
- `Node`, `Edge` from `src/schema/types.ts`
- `EdgeKind`, `NodeKind` from `src/constants.ts`

**Tasks**:

| Task ID | Task Type | Depends On | Files in Scope | Tests Owned Files | Test Command(s) | Acceptance Criteria |
|---------|-----------|------------|----------------|-------------------|-----------------|---------------------|
| P4-SL-PROJ-01 | test | IF-0-P4-VIEWCONFIG | - | tests/unit/view-service/types.test.ts | npm test -- tests/unit/view-service/types.test.ts | Tests for ViewConfig validation exist |
| P4-SL-PROJ-02 | impl | P4-SL-PROJ-01 | src/view-service/types.ts | tests/unit/view-service/types.test.ts | npm test -- tests/unit/view-service/types.test.ts | ViewConfig types defined with validation |
| P4-SL-PROJ-03 | test | P4-SL-PROJ-02 | - | tests/unit/view-service/projector.test.ts | npm test -- tests/unit/view-service/projector.test.ts | Projector tests for all view types |
| P4-SL-PROJ-04 | impl | P4-SL-PROJ-03 | src/view-service/projector/projector.ts, src/view-service/projector/index.ts | tests/unit/view-service/projector.test.ts | npm test -- tests/unit/view-service/projector.test.ts | Projector extracts correct subgraphs |
| P4-SL-PROJ-05 | verify | P4-SL-PROJ-04 | - | tests/unit/view-service/projector.test.ts | npm test -- tests/unit/view-service | All projector tests pass |

---

### SL-LAYOUT -- ELK Layout Integration

**Scope**:
- Integrate elkjs for deterministic layout computation
- Convert graph nodes/edges to ELK format
- Apply computed positions back to nodes
- Support incremental layout for connected components

**Owned Files**:
- `src/view-service/layout/elk-client.ts`
- `src/view-service/layout/index.ts`
- `tests/unit/view-service/elk-client.test.ts`
- `package.json` (dependency additions only)

**Interfaces Provided**:
- `ELKLayoutEngine`, `createELKLayoutEngine()` (elk-client.ts)

**Interfaces Consumed**:
- `Node`, `Edge` from `src/schema/types.ts`
- `Position` from `src/view-service/types.ts`

**Tasks**:

| Task ID | Task Type | Depends On | Files in Scope | Tests Owned Files | Test Command(s) | Acceptance Criteria |
|---------|-----------|------------|----------------|-------------------|-----------------|---------------------|
| P4-SL-LAYOUT-01 | impl | - | package.json | - | npm install | elkjs dependency added |
| P4-SL-LAYOUT-02 | test | P4-SL-LAYOUT-01, P4-SL-PROJ-02 | - | tests/unit/view-service/elk-client.test.ts | npm test -- tests/unit/view-service/elk-client.test.ts | ELK layout tests exist |
| P4-SL-LAYOUT-03 | impl | P4-SL-LAYOUT-02 | src/view-service/layout/elk-client.ts, src/view-service/layout/index.ts | tests/unit/view-service/elk-client.test.ts | npm test -- tests/unit/view-service/elk-client.test.ts | ELK layout produces deterministic positions |
| P4-SL-LAYOUT-04 | verify | P4-SL-LAYOUT-03 | - | tests/unit/view-service/elk-client.test.ts | npm test -- tests/unit/view-service/elk-client.test.ts | All ELK tests pass with same input = same output |

---

### SL-API -- API Server & Formatting

**Scope**:
- Build Cytoscape element formatter
- Create Express HTTP server with REST endpoints
- Wire projector, layout engine, and pattern matcher
- Implement full view generation pipeline

**Owned Files**:
- `src/view-service/formatter/formatter.ts`
- `src/view-service/formatter/index.ts`
- `src/view-service/api/server.ts`
- `src/view-service/api/index.ts`
- `src/view-service/index.ts`
- `tests/unit/view-service/formatter.test.ts`
- `tests/unit/view-service/server.test.ts`

**Interfaces Provided**:
- `CytoscapeNode`, `CytoscapeEdge`, `CytoscapeElements`, `CytoscapeFormatter`, `createFormatter()` (formatter.ts)
- `ViewServiceOptions`, `createViewServer()` (server.ts)

**Interfaces Consumed**:
- `GraphProjector` from `src/view-service/projector/projector.ts`
- `ELKLayoutEngine` from `src/view-service/layout/elk-client.ts`
- `ViewConfig`, `ViewResponse`, `Position` from `src/view-service/types.ts`
- `PatternMatcherInterface` from `src/patterns/matcher/matcher.ts`
- `GraphStore` from `src/graph/store.ts`

**Tasks**:

| Task ID | Task Type | Depends On | Files in Scope | Tests Owned Files | Test Command(s) | Acceptance Criteria |
|---------|-----------|------------|----------------|-------------------|-----------------|---------------------|
| P4-SL-API-01 | test | P4-SL-PROJ-02 | - | tests/unit/view-service/formatter.test.ts | npm test -- tests/unit/view-service/formatter.test.ts | Formatter tests for node/edge conversion |
| P4-SL-API-02 | impl | P4-SL-API-01 | src/view-service/formatter/formatter.ts, src/view-service/formatter/index.ts | tests/unit/view-service/formatter.test.ts | npm test -- tests/unit/view-service/formatter.test.ts | Formatter produces valid Cytoscape elements |
| P4-SL-API-03 | impl | P4-SL-API-02 | package.json | - | npm install | express, cors, @types/express dependencies added |
| P4-SL-API-04 | test | P4-SL-API-03, P4-SL-PROJ-04, P4-SL-LAYOUT-03 | - | tests/unit/view-service/server.test.ts | npm test -- tests/unit/view-service/server.test.ts | API endpoint tests exist |
| P4-SL-API-05 | impl | P4-SL-API-04 | src/view-service/api/server.ts, src/view-service/api/index.ts, src/view-service/index.ts | tests/unit/view-service/server.test.ts | npm test -- tests/unit/view-service/server.test.ts | All API endpoints respond correctly |
| P4-SL-API-06 | verify | P4-SL-API-05 | - | tests/unit/view-service/server.test.ts | npm test -- tests/unit/view-service | All view-service tests pass |

---

## E. Execution Notes

### Parallelization Strategy

```
Phase Start
    |
    +---> SL-PROJ (tasks 01-04)  --+
    |                              |
    +---> SL-LAYOUT (tasks 01-03) -+---> SL-API (tasks 01-06)
                                   |
                                   v
                              Phase Complete
```

- **SL-PROJ** and **SL-LAYOUT** can run in parallel after interface freeze
- **SL-API** must wait for both SL-PROJ and SL-LAYOUT to complete
- Within SL-API, tasks are sequential (test -> impl -> verify)

### Serialization Points

1. `src/view-service/types.ts` must be created before SL-LAYOUT can start (shared types)
2. `package.json` modifications happen in SL-LAYOUT and SL-API - run `npm install` after each

### Unblocking Deliverables

1. **types.ts** - Unblocks all lanes (shared type definitions)
2. **elkjs dependency** - Unblocks ELK client implementation
3. **express dependency** - Unblocks API server implementation

---

## F. File-by-File Specification

### `src/view-service/types.ts` -- added -- Owner: SL-PROJ

**Purpose**: Define all view-related types and configurations.

**Key Responsibilities**:
- Export ViewType, ViewConfig, ProjectionResult, ViewResponse, Position interfaces
- Provide type guards for ViewConfig validation
- Define default values for optional config fields

**Interfaces Exposed**:
- `ViewType` - Union of view type strings
- `ViewConfig` - Full view configuration
- `ProjectionResult` - Raw projection output
- `ViewResponse` - Complete response with layout
- `Position` - x/y coordinates

**Tests Required**:
- ViewConfig validation with all fields
- Default value application
- Type guard accuracy

---

### `src/view-service/projector/projector.ts` -- added -- Owner: SL-PROJ

**Purpose**: Extract view-specific subgraphs from the graph store.

**Key Responsibilities**:
- Implement depth-bounded traversal from root node
- Filter edges by kind based on view type
- Apply confidence threshold filtering
- Exclude nodes matching path patterns
- Handle collapse semantics for node grouping

**Interfaces Exposed**:
- `GraphProjector` - Main projection interface
- `createProjector()` - Factory function

**Tests Required**:
- Subgraph extraction at various depths
- Edge kind filtering per view type
- Confidence threshold filtering
- Path exclusion patterns
- Collapse semantics

---

### `src/view-service/layout/elk-client.ts` -- added -- Owner: SL-LAYOUT

**Purpose**: Compute deterministic graph layouts using ELK.

**Key Responsibilities**:
- Convert Node/Edge arrays to ELK graph format
- Configure ELK for hierarchical/layered layout
- Extract position results back to Position map
- Handle empty and single-node graphs
- Ensure deterministic output (same input = same positions)

**Interfaces Exposed**:
- `ELKLayoutEngine` - Layout computation interface
- `createELKLayoutEngine()` - Factory function

**Tests Required**:
- Layout produces valid positions for all nodes
- Same input produces same output (determinism)
- Empty graph handling
- Single node handling
- Complex graph with hierarchy

---

### `src/view-service/formatter/formatter.ts` -- added -- Owner: SL-API

**Purpose**: Convert graph data to Cytoscape.js element format.

**Key Responsibilities**:
- Transform Node to CytoscapeNode with proper data fields
- Transform Edge to CytoscapeEdge with source/target
- Apply position data to node elements
- Add CSS classes based on node/edge kinds
- Apply pattern overlay highlighting

**Interfaces Exposed**:
- `CytoscapeNode`, `CytoscapeEdge`, `CytoscapeElements`
- `CytoscapeFormatter` - Formatting interface
- `createFormatter()` - Factory function

**Tests Required**:
- Node conversion preserves all fields
- Edge conversion with correct source/target
- Position application
- Pattern overlay classes

---

### `src/view-service/api/server.ts` -- added -- Owner: SL-API

**Purpose**: HTTP REST API for view service operations.

**Key Responsibilities**:
- Create Express server with CORS
- Implement GET /views endpoint (list view types)
- Implement POST /view endpoint (generate view)
- Implement POST /layout/elk endpoint (compute layout)
- Implement POST /patterns/run endpoint (run pattern detection)
- Wire projector, layout engine, formatter, and matcher

**Interfaces Exposed**:
- `ViewServiceOptions` - Server configuration
- `createViewServer()` - Factory function returning start/stop/app

**Tests Required**:
- GET /views returns correct view types
- POST /view generates valid ViewResponse
- POST /layout/elk returns positions
- POST /patterns/run returns pattern matches
- Error handling for invalid requests

---

## H. Test Execution Plan

### Test Commands by Lane

```bash
# SL-PROJ tests
npm test -- tests/unit/view-service/types.test.ts
npm test -- tests/unit/view-service/projector.test.ts

# SL-LAYOUT tests
npm test -- tests/unit/view-service/elk-client.test.ts

# SL-API tests
npm test -- tests/unit/view-service/formatter.test.ts
npm test -- tests/unit/view-service/server.test.ts

# Full view-service suite
npm test -- tests/unit/view-service

# Full project suite
npm test
```

### Test Ordering Constraints

1. Run type tests first (no dependencies)
2. Run projector tests after types
3. Run ELK tests after dependencies installed
4. Run formatter tests after types
5. Run server tests after all other view-service tests
6. Full suite validates everything works together

### Smoke Tests

- `npm test -- tests/unit/view-service/types.test.ts` - Validates types compile
- `npm run build` - Validates TypeScript compilation

---

## J. Acceptance Criteria

| Criterion | Test | Pass Condition |
|-----------|------|----------------|
| View projection correctly filters and bounds graphs | projector.test.ts | Subgraph contains only nodes within depth and matching edge kinds |
| ELK produces deterministic layouts | elk-client.test.ts | Same input graph produces identical positions on repeated runs |
| API responds in <200ms for typical views | server.test.ts | POST /view completes within 200ms for 100-node graph |
| Cytoscape elements render correctly | formatter.test.ts | All required Cytoscape data fields present and valid |
| All view types supported | projector.test.ts | call_graph, inheritance, module_deps, full all work |
| Confidence filtering works | projector.test.ts | Edges below threshold excluded from projection |
| Pattern overlay applied | formatter.test.ts | Pattern match nodes get correct CSS classes |
| npm run build succeeds | build command | Zero TypeScript errors |
| npm test passes | test command | All tests pass with >80% coverage |

---

## Output Validation Checklist

### Structure
- [x] Document has correct `# P4: View Service` heading
- [x] All required sections (A through J) are present
- [x] Lane Index & Dependencies section is machine-parseable

### Gates
- [x] All interface contracts have `IF-*` gates
- [x] Gate IDs follow naming convention

### Lanes
- [x] Each lane has unique ID (SL-PROJ, SL-LAYOUT, SL-API)
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
