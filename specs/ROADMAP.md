# ROADMAP: Semantic Lens - Semantic Code Graph Visualization Platform

> **Version**: 1.0.0
> **Generated**: 2026-01-01
> **Spec Source**: `specs/plain_english_spec.md`
> **Architecture**: `.claude/architecture/CODEBASE.md`

---

## Control Plane Reminder

This roadmap is designed for execution via the **ai-dev-kit** plugin in Claude Code:

- **Plan phases**: `/ai-dev-kit:plan-phase specs/ROADMAP.md "Phase N"`
- **Execute lanes**: `/ai-dev-kit:execute-lane plans/phase-N.md SL-X`
- **Execute phases**: `/ai-dev-kit:execute-phase plans/phase-N.md`

For tasks better suited to other agents, use delegation:
- **Large context analysis**: `/ai-dev-kit:delegate gemini "Analyze pattern detection edge cases"`
- **Quick codegen**: `/ai-dev-kit:delegate cursor "Generate Cytoscape element formatter"`
- **Sandboxed execution**: `/ai-dev-kit:delegate codex "Build and test schema validator"`

---

## Executive Summary

**Semantic Lens** is a developer tool for semantic code analysis and visualization. It processes codebase data from external chunkers/analyzers, stores it in a graph database, detects design patterns using declarative rules, and renders interactive architectural diagrams using Cytoscape.js with deterministic ELK layouts.

### Core Capabilities
1. **Schema-validated ingestion** of SemanticGraphBundle payloads (nodes, edges, annotations, patterns)
2. **Graph storage** with Memgraph/Neo4j (or in-memory fallback)
3. **Pattern detection** via Cypher queries compiled from a YAML DSL
4. **Interactive visualization** with lenses, filters, and pattern overlays
5. **Deterministic layout** using ELK for reproducible diagrams

### Why This Matters
Developers struggle to understand large codebases. Semantic Lens provides:
- Visual exploration of call graphs, inheritance hierarchies, and module dependencies
- Automatic detection of design patterns (Observer, Strategy, Factory, Singleton)
- Confidence-scored relationships for quality-aware exploration
- Incremental updates for real-time development feedback

---

## Current State

This is a **greenfield project** with no existing code. The only artifacts are:
- `specs/plain_english_spec.md` - Full specification with JSON Schema, Cypher queries, DSL examples
- `.claude/architecture/CODEBASE.md` - Planned architecture documentation
- `.claude/architecture/TECH-DEBT.md` - Pre-implementation consideration notes

### Technology Decisions (from spec)
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | TypeScript | Type safety, ecosystem compatibility |
| Graph Visualization | Cytoscape.js | Mature, extensible, compound nodes |
| Layout Engine | ELK (elkjs) | Deterministic, high-quality layouts |
| Schema Validation | AJV | Fast JSON Schema 2020-12 support |
| Graph Database | Memgraph/Neo4j | Cypher support, pattern queries |
| Fallback Store | In-memory | Client-side use, no DB dependency |

---

## Target State

After full implementation, Semantic Lens will provide:

```
                                    +------------------+
                                    |    Developer     |
                                    +--------+---------+
                                             |
                                    +--------v---------+
                                    | Visualization UI |
                                    | (Cytoscape.js)   |
                                    +--------+---------+
                                             |
                              +--------------+--------------+
                              |                             |
                    +---------v---------+         +---------v---------+
                    |   View Service    |         |  Pattern Engine   |
                    | (Projector + ELK) |<------->| (Cypher/In-Mem)   |
                    +---------+---------+         +---------+---------+
                              |                             |
                    +---------v-----------------------------v---------+
                    |                  Graph Store                     |
                    |         (Memgraph/Neo4j/In-Memory)              |
                    +------------------------+-------------------------+
                                             |
                    +------------------------v-------------------------+
                    |              Schema Validator (AJV)              |
                    +------------------------+-------------------------+
                                             |
                    +------------------------v-------------------------+
                    |           External Code Chunker                  |
                    +--------------------------------------------------+
```

### Key Deliverables
1. **SemanticGraphBundle JSON Schema** (`semantic-graph-bundle.schema.json`)
2. **Graph store abstraction** with Memgraph and in-memory implementations
3. **Pattern DSL v1** with Cypher compiler
4. **View Service API** with ELK integration
5. **Interactive Cytoscape UI** with lenses and pattern overlays

---

## Phase Overview

| Phase | Name | Objective | Swim Lanes | Est. Duration |
|-------|------|-----------|------------|---------------|
| 1 | Foundation | Core infrastructure: schema, validation, project setup | 2 | 1 week |
| 2 | Graph Core | Graph storage, loading, and basic queries | 2 | 1 week |
| 3 | Pattern Engine | Pattern DSL, Cypher compilation, detection | 2 | 1.5 weeks |
| 4 | View Service | Graph projection, ELK layout, API endpoints | 3 | 1.5 weeks |
| 5 | Visualization | Cytoscape UI, lenses, pattern overlays | 2 | 1.5 weeks |
| 6 | Integration | End-to-end testing, documentation, polish | 2 | 1 week |

**Total Estimated Duration**: 7.5 weeks

---

## Phase 1: Foundation

### Objectives
- Establish project structure and tooling
- Implement JSON Schema validation for SemanticGraphBundle
- Create core TypeScript types from schema

### Scope

#### SL-1.1: Project Setup
- Initialize TypeScript project with modern tooling
- Configure ESLint, Prettier, Vitest
- Set up directory structure per architecture spec
- Create package.json with dependencies

#### SL-1.2: Schema & Validation
- Implement `semantic-graph-bundle.schema.json` (from spec)
- Create AJV-based validator with clear error messages
- Generate TypeScript types from schema
- Build test fixtures (valid/invalid bundles)

### Interface Contracts

```typescript
// src/schema/types.ts - Generated from JSON Schema
interface SemanticGraphBundle {
  version: string;  // e.g., "v1.0"
  generated_at: string;  // ISO date-time
  repo?: { name: string; commit: string; root: string };
  nodes: Node[];
  edges: Edge[];
  annotations: Annotation[];
  patterns: PatternInstance[];
}

// src/schema/validator.ts
interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

function validateBundle(data: unknown): ValidationResult;
```

### Success Criteria
- [ ] `npm run build` compiles without errors
- [ ] `npm run test` passes with >80% coverage on schema module
- [ ] `npm run validate -- sample.json` correctly validates bundles
- [ ] TypeScript types match JSON Schema definitions exactly

### Dependencies
- None (foundation phase)

### Technical Debt Considerations
- TD-003: Version schema from start, plan for migrations
- TD-008: Create setup script for easy onboarding

---

## Phase 2: Graph Core

### Objectives
- Implement graph store abstraction
- Build bundle loader for ingesting validated data
- Create basic graph query utilities

### Scope

#### SL-2.1: Graph Store Abstraction
- Define `GraphStore` interface
- Implement `InMemoryStore` (full functionality)
- Implement `MemgraphStore` (optional DB backend)
- Add connection management and error handling

#### SL-2.2: Bundle Loader & Queries
- Build loader that transforms bundle into graph operations
- Implement common queries (neighbors, paths, subgraphs)
- Add indexing for fast lookups (by kind, route, file)
- Create test fixtures with representative graphs

### Interface Contracts

```typescript
// src/graph/store.ts
interface GraphStore {
  // Write operations
  loadBundle(bundle: SemanticGraphBundle): Promise<void>;
  addNode(node: Node): Promise<void>;
  addEdge(edge: Edge): Promise<void>;

  // Read operations
  getNode(nodeId: string): Promise<Node | null>;
  getEdge(edgeId: string): Promise<Edge | null>;
  getNeighbors(nodeId: string, direction: 'in' | 'out' | 'both'): Promise<Node[]>;
  getEdgesForNode(nodeId: string): Promise<Edge[]>;

  // Query operations
  findNodes(criteria: NodeQuery): Promise<Node[]>;
  findEdges(criteria: EdgeQuery): Promise<Edge[]>;
  getSubgraph(rootId: string, depth: number, edgeKinds?: EdgeKind[]): Promise<SubgraphResult>;

  // Lifecycle
  clear(): Promise<void>;
  close(): Promise<void>;
}

// src/graph/queries.ts
interface SubgraphResult {
  nodes: Node[];
  edges: Edge[];
}
```

### Success Criteria
- [ ] `InMemoryStore` passes all interface tests
- [ ] `MemgraphStore` works with local Memgraph instance
- [ ] Bundle loading completes in <100ms for 1000-node graphs
- [ ] Subgraph extraction returns correct connected components

### Dependencies
- Phase 1 (schema types, validation)

### Technical Debt Considerations
- TD-001: Ensure in-memory store is production-ready, not just fallback
- TD-002: Implement lazy loading hooks from start

---

## Phase 3: Pattern Engine

### Objectives
- Implement Pattern DSL parser (YAML)
- Build Cypher query compiler
- Create in-memory pattern matcher
- Implement confidence scoring

### Scope

#### SL-3.1: DSL & Cypher Compiler
- Parse YAML pattern definitions (DSL v1 format)
- Compile role specs to Cypher MATCH clauses
- Compile constraints to WHERE/WITH clauses
- Handle optional constraints with OPTIONAL MATCH
- Generate scoring expressions

#### SL-3.2: In-Memory Matcher & Scoring
- Implement constraint solver for in-memory matching
- Build pattern matcher using graph store queries
- Implement confidence scoring algorithm
- Create pattern definitions for Observer, Strategy, Factory, Singleton

### Interface Contracts

```typescript
// src/patterns/types.ts
interface PatternDefinition {
  id: string;
  roles: Record<string, RoleSpec>;
  constraints: Constraint[];
  scoring: ScoringConfig;
}

interface PatternMatch {
  instanceId: string;
  patternId: string;
  roles: Record<string, string>;  // role -> nodeId
  confidence: number;
  evidence: string[];
  explain?: string;
}

// src/patterns/matcher.ts
interface PatternMatcher {
  loadDefinitions(patterns: PatternDefinition[]): void;
  match(graph: GraphStore, scope?: string[]): Promise<PatternMatch[]>;
  matchPattern(graph: GraphStore, patternId: string): Promise<PatternMatch[]>;
}

// src/patterns/cypher.ts
interface CypherCompiler {
  compile(pattern: PatternDefinition): string;
}
```

### Success Criteria
- [ ] DSL parser correctly parses all spec examples
- [ ] Cypher compiler generates valid Cypher queries
- [ ] In-memory matcher produces same results as Cypher queries
- [ ] Pattern detection runs in <500ms for 1000-node graphs
- [ ] All 4 base patterns (Observer, Strategy, Factory, Singleton) implemented

### Dependencies
- Phase 2 (graph store for matching)

### Technical Debt Considerations
- TD-004: Build comprehensive test graphs with known patterns
- TD-006: Start with core patterns, defer exotic patterns

---

## Phase 4: View Service

### Objectives
- Implement graph projection with configurable views
- Integrate ELK for deterministic layout
- Build HTTP API for view requests
- Create Cytoscape element formatter

### Scope

#### SL-4.1: Graph Projector
- Implement view-specific subgraph extraction
- Add filtering by edge kinds, confidence, paths
- Support collapse/expand semantics
- Implement depth-bounded traversal

#### SL-4.2: ELK Layout Integration
- Integrate elkjs for layout computation
- Convert graph to ELK format
- Apply layout positions back to nodes
- Implement incremental layout for components

#### SL-4.3: API & Formatting
- Build Express/Fastify HTTP server
- Implement `GET /views`, `POST /view`, `POST /layout/elk`
- Add `POST /patterns/run` endpoint
- Create Cytoscape element formatter

### Interface Contracts

```typescript
// src/view-service/types.ts
interface ViewConfig {
  view: 'call_graph' | 'inheritance' | 'module_deps' | 'full';
  root_id?: string;
  depth?: number;
  edge_kinds?: EdgeKind[];
  min_confidence?: number;
  collapse_kinds?: NodeKind[];
  exclude_paths?: string[];
}

interface ViewResponse {
  elements: CytoscapeElements;
  positions: Record<string, { x: number; y: number }>;
  patterns?: PatternMatch[];
}

// src/view-service/formatter.ts
interface CytoscapeElements {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

// src/view-service/api.ts
// GET /views -> { views: string[] }
// POST /view -> ViewResponse
// POST /layout/elk -> { positions: Record<string, Position> }
// POST /patterns/run -> { patterns: PatternMatch[] }
```

### Success Criteria
- [ ] View projection correctly filters and bounds graphs
- [ ] ELK produces deterministic layouts (same input = same output)
- [ ] API responds in <200ms for typical views
- [ ] Cytoscape elements render correctly in browser

### Dependencies
- Phase 2 (graph store)
- Phase 3 (pattern engine for overlays)

### Technical Debt Considerations
- TD-005: Consider server-side ELK to reduce bundle size

---

## Phase 5: Visualization

### Objectives
- Build interactive Cytoscape graph viewer
- Implement lenses and filter controls
- Add pattern overlay visualization
- Create expand/collapse interaction

### Scope

#### SL-5.1: Cytoscape Graph Component
- Create Cytoscape wrapper component
- Implement node/edge styling by kind
- Add zoom, pan, fit controls
- Support compound nodes for hierarchical display

#### SL-5.2: Controls & Overlays
- Build lens controls (edge kind toggles)
- Implement confidence slider filter
- Add pattern overlay visualization (hulls, highlights)
- Create expand/collapse node interaction
- Build pattern list panel with navigation

### Interface Contracts

```typescript
// src/ui/types.ts
interface GraphViewProps {
  elements: CytoscapeElements;
  positions: Record<string, Position>;
  patterns?: PatternMatch[];
  onNodeClick?: (nodeId: string) => void;
  onNodeExpand?: (nodeId: string) => void;
}

interface LensConfig {
  edgeKinds: EdgeKind[];
  minConfidence: number;
  showPatterns: boolean;
  patternFilter?: string[];
}

// src/ui/controls.ts
interface GraphControls {
  setLens(config: LensConfig): void;
  expandNode(nodeId: string): void;
  collapseNode(nodeId: string): void;
  highlightPattern(instanceId: string): void;
  fitToView(): void;
  exportPNG(): Promise<Blob>;
}
```

### Success Criteria
- [ ] Graph renders with correct styling for all node/edge kinds
- [ ] Lenses correctly filter displayed elements
- [ ] Pattern overlays highlight participating nodes
- [ ] Expand/collapse works smoothly with layout updates
- [ ] UI is responsive and handles 500+ visible nodes

### Dependencies
- Phase 4 (view service API, Cytoscape elements)

---

## Phase 6: Integration

### Objectives
- End-to-end testing with real codebase data
- Performance optimization and profiling
- Documentation and examples
- CLI tooling for batch operations

### Scope

#### SL-6.1: E2E Testing & Performance
- Create E2E test suite with Playwright
- Test full flow: load bundle -> view -> patterns
- Profile and optimize hot paths
- Add caching for computed views

#### SL-6.2: Documentation & CLI
- Write user documentation (README, usage guide)
- Document API endpoints
- Create CLI for common operations
- Build example bundles from open-source projects

### Interface Contracts

```typescript
// src/cli/index.ts
// semantic-lens validate <bundle.json>
// semantic-lens load <bundle.json> [--db <uri>]
// semantic-lens patterns [--output <file>]
// semantic-lens serve [--port <port>]
// semantic-lens export <view-config.json> [--format png|svg]
```

### Success Criteria
- [ ] E2E tests cover all major user flows
- [ ] Performance meets targets (<200ms typical views)
- [ ] README provides clear getting-started guide
- [ ] CLI successfully processes real codebase bundles

### Dependencies
- All previous phases

---

## Cross-Phase Interfaces

### Interface Freeze Points

| Interface | Defined In | Frozen After | Consumers |
|-----------|------------|--------------|-----------|
| `SemanticGraphBundle` | Phase 1 | Phase 1 | All phases |
| `GraphStore` | Phase 2 | Phase 2 | Phases 3, 4, 5 |
| `PatternMatcher` | Phase 3 | Phase 3 | Phase 4 |
| `ViewConfig` | Phase 4 | Phase 4 | Phase 5 |
| `CytoscapeElements` | Phase 4 | Phase 4 | Phase 5 |

### Shared Constants

```typescript
// src/constants.ts
export const NODE_KINDS = ['module', 'class', 'interface', 'trait', 'function', 'method', 'field', 'property'] as const;
export const EDGE_KINDS = ['defines', 'imports', 'calls', 'inherits', 'implements', 'uses', 'reads', 'writes', 'throws'] as const;
export const EVIDENCE_TYPES = ['chunker', 'lsp', 'static_analysis', 'heuristic', 'llm_score'] as const;
```

---

## Risk Mitigation

### High Risk: Graph DB Dependency (TD-001)
**Mitigation**: In-memory store is implemented as first-class citizen in Phase 2, not afterthought.

### Medium Risk: ELK Performance (TD-005)
**Mitigation**: Implement incremental layout (per connected component) in Phase 4. Consider server-side ELK for production.

### Medium Risk: Pattern DSL Complexity (TD-006)
**Mitigation**: Start with 4 well-defined patterns. DSL evolves based on real usage.

---

## Appendix: File Structure

```
semantic-lens/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── constants.ts              # Shared constants
│   ├── schema/                   # Phase 1
│   │   ├── semantic-graph-bundle.schema.json
│   │   ├── types.ts              # Generated types
│   │   └── validator.ts          # AJV validation
│   ├── graph/                    # Phase 2
│   │   ├── store.ts              # GraphStore interface
│   │   ├── memory-store.ts       # In-memory implementation
│   │   ├── memgraph-store.ts     # Memgraph implementation
│   │   ├── loader.ts             # Bundle loader
│   │   └── queries.ts            # Query utilities
│   ├── patterns/                 # Phase 3
│   │   ├── types.ts              # Pattern types
│   │   ├── dsl/                  # YAML DSL parser
│   │   │   └── parser.ts
│   │   ├── cypher/               # Cypher compiler
│   │   │   └── compiler.ts
│   │   ├── matcher/              # In-memory matcher
│   │   │   └── matcher.ts
│   │   ├── scorer.ts             # Confidence scoring
│   │   └── definitions/          # Pattern YAML files
│   │       ├── observer.yaml
│   │       ├── strategy.yaml
│   │       ├── factory.yaml
│   │       └── singleton.yaml
│   ├── view-service/             # Phase 4
│   │   ├── types.ts              # View types
│   │   ├── api/                  # HTTP endpoints
│   │   │   └── server.ts
│   │   ├── projector/            # Graph projection
│   │   │   └── projector.ts
│   │   ├── layout/               # ELK integration
│   │   │   └── elk-client.ts
│   │   └── formatter/            # Cytoscape formatting
│   │       └── formatter.ts
│   ├── ui/                       # Phase 5
│   │   ├── graph/                # Cytoscape wrapper
│   │   │   └── graph-view.ts
│   │   ├── controls/             # Lenses, filters
│   │   │   ├── lens-panel.ts
│   │   │   └── pattern-panel.ts
│   │   └── overlays/             # Pattern visualization
│   │       └── pattern-overlay.ts
│   └── cli/                      # Phase 6
│       └── index.ts
├── patterns/                     # Pattern definition files
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── fixtures/                     # Test data
│   ├── valid-bundle.json
│   ├── invalid-bundle.json
│   └── sample-graphs/
└── docs/
    ├── README.md
    └── api.md
```

---

## Next Steps

1. **Start Phase 1**: `/ai-dev-kit:plan-phase specs/ROADMAP.md "Phase 1"`
2. **Review interfaces**: Confirm interface contracts before implementation
3. **Set up CI/CD**: Configure GitHub Actions for automated testing

---

*Generated by `/ai-dev-kit:plan-roadmap` from `specs/plain_english_spec.md`*
