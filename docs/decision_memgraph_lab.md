# ADR: Memgraph Lab as Analysis Sandbox

**Status**: Accepted
**Date**: 2026-01-03
**Context**: Graph quality iteration workflow

## Decision

Use Memgraph Lab **alongside** (not replacing) Cytoscape.js for graph analysis.

## Context

During development, we need to rapidly iterate on graph quality:
- Identify isolates (disconnected nodes)
- Find coupling hotspots
- Validate edge detection quality
- Distinguish synthetic vs semantic edges
- Analyze architectural patterns

The current Cytoscape.js visualization is optimized for code-centric exploration but makes these analysis tasks difficult due to:
- No query language (manual filtering)
- Layout recalculates on each filter change
- Large graphs (400+ nodes) are slow to manipulate
- No aggregate statistics

## Evaluation

### Option 1: Enhance Cytoscape UI

Add query capabilities, statistics panels, and filtering UI to Cytoscape.

**Pros**: Single tool, integrated experience
**Cons**: Significant development time, reinventing query language

### Option 2: Memgraph Lab as Sandbox

Use Memgraph Lab for analysis, Cytoscape for code exploration.

**Pros**:
- Immediate Cypher query capability
- Built-in graph statistics
- Professional visualization
- Zero development time
- Saved queries persist across sessions

**Cons**:
- Two tools to context-switch between
- Data sync (re-import after regeneration)

### Option 3: Replace Cytoscape with Lab

Use Memgraph Lab as the primary visualization.

**Pros**: Powerful out of the box
**Cons**:
- Loses semantic zoom (module → class → method)
- No containment-first hierarchy
- No custom overlays for pattern visualization
- Generic graph UX, not code-centric

## Decision Rationale

**Option 2** provides the best balance:

| Capability | Memgraph Lab | Cytoscape |
|-----------|--------------|-----------|
| Cypher queries | ✅ Native | ❌ None |
| Graph statistics | ✅ Built-in | ❌ Manual |
| Semantic zoom | ❌ Flat graph | ✅ Designed for |
| Containment hierarchy | ❌ Not supported | ✅ Core feature |
| Pattern overlays | ❌ Generic styling | ✅ Custom implementation |
| Code-centric UX | ❌ Generic | ✅ Purpose-built |
| Development cost | ✅ Zero | ⚠️ Already invested |

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  Development Cycle                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. Generate bundle                                        │
│      semantic-lens analyze ./src --output bundle.slb        │
│                           │                                 │
│                           ▼                                 │
│   2. Import to Memgraph                                     │
│      npx ts-node tools/import_memgraph.ts bundle.slb        │
│                           │                                 │
│                           ▼                                 │
│   3. Analyze in Lab (http://localhost:3003)                 │
│      - Run isolate queries                                  │
│      - Check coupling hotspots                              │
│      - Validate edge quality                                │
│                           │                                 │
│                           ▼                                 │
│   4. If graph quality issues found:                         │
│      - Adjust chunker/analyzer                              │
│      - Re-run from step 1                                   │
│                           │                                 │
│                           ▼                                 │
│   5. Explore in Cytoscape (demo.html)                       │
│      - Semantic zoom navigation                             │
│      - Pattern visualization                                │
│      - Code-centric exploration                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Consequences

### Positive

- Fast iteration on graph quality (~10 minute loop)
- No development overhead for analysis features
- Cytoscape stays focused on code exploration
- Standard Cypher skills transfer
- Lab queries can be saved and version-controlled

### Negative

- Context switch between two tools
- Need to re-import after bundle regeneration
- Docker dependency for analysis workflow
- Port management (Lab defaults to 3003)

### Mitigations

- Clear documentation in ONBOARDING.md
- One-liner import command
- Port configurable via environment variable
- Saved queries in `docs/memgraph_queries.md`

## References

- [Memgraph Lab](https://memgraph.com/product/memgraph-lab)
- [Cytoscape.js](https://js.cytoscape.org/)
- [docs/memgraph_queries.md](./memgraph_queries.md) - Saved analysis queries
