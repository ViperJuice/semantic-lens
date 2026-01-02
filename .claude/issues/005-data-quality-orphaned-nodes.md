# Issue #005: Data Quality - Orphaned Nodes and Missing Edge Types

**Type**: Data Quality
**Priority**: Medium
**Status**: Open

## Problem

Analysis of the fixture data (`fixtures/semantic-lens-v4.slb`) reveals significant data quality issues that impact visualization accuracy:

### 1. Orphaned Nodes (200 nodes)

Approximately 200 nodes have a `parent` field referencing a non-existent node. These are "orphaned" nodes - they claim to belong to a parent (typically a class or module) that doesn't exist in the graph.

**Impact:**
- Parent-child relationships are broken
- Hierarchical visualizations (compound nodes) won't work correctly
- Navigation and drill-down features won't function

**Example:**
```json
{
  "node_id": "abc123",
  "kind": "method",
  "name": "doSomething",
  "parent": "xyz789"  // This node ID doesn't exist in the graph
}
```

### 2. Missing Edge Types (Only `calls` edges present)

The dataset only contains `calls` edges (262 total). Missing edge types include:
- `defines` - class/module defines methods/properties (0 edges)
- `implements` - class implements interface (0 edges)
- `inherits` - class extends another class (0 edges)
- `uses` - function uses/references another symbol (0 edges)

**Impact:**
- Interfaces appear isolated (no `implements` edges connect them)
- Class hierarchies are invisible (no `inherits` edges)
- Method ownership is unclear (no `defines` edges)

### 3. Isolated Nodes (283 nodes / 65%)

283 out of 427 nodes have zero edges (degree = 0). While some isolation is expected (e.g., utility functions), this high percentage suggests missing relationships.

**Breakdown by kind:**
- Interfaces: Expected to be isolated in pure structural analysis, but would have `implements` edges in complete data
- Methods: Should have at least a `defines` edge from their parent class
- Functions: Many should have `calls` or `uses` edges

## Root Cause Analysis

The data is exported from `treesitter-chunker` using `SemanticLensExporter`. The exporter:
1. Maps chunks to nodes correctly
2. Only captures relationships that are explicitly tracked by the chunker
3. Parent references may not be resolved if parent chunks are filtered out

### Potential issues in the chunker:
- Parent chunk IDs may use different format than node IDs
- Relationship extraction may be limited to `calls` relationships
- Some chunk types may be filtered before export

## Recommendations

### Short-term (visualization side)

1. **Visual indicators for orphaned nodes** (DONE)
   - Dashed orange border for nodes with invalid parent references
   - Implemented in `markSuspiciousNodes()` function

2. **Connectivity-based coloring** (DONE)
   - Gray for isolated nodes, vibrant colors for connected nodes
   - Implemented in `colorByConnectivity()` function

### Medium-term (data pipeline)

3. **Improve relationship extraction in treesitter-chunker**
   - Add `defines` edges for class-method relationships
   - Add `implements` edges for interface implementations
   - Add `inherits` edges for class inheritance

4. **Validate parent references before export**
   - Build parent ID lookup before generating nodes
   - Either resolve dangling parents or remove the parent field

5. **Add edge confidence scoring**
   - Some edges may be inferred vs. explicit
   - Allow visualization to filter by confidence

### Long-term (schema enhancement)

6. **Add node validation to SemanticGraphBundle schema**
   - Required: All parent references must resolve
   - Warning: Nodes with zero edges should be flagged

## Data Statistics

| Metric | Value |
|--------|-------|
| Total nodes | 427 |
| Total edges | 262 |
| Orphaned nodes | ~200 |
| Isolated nodes (degree=0) | 283 (65%) |
| Edge types present | `calls` only |
| Edge types missing | `defines`, `implements`, `inherits`, `uses` |

## Related Files

- `/home/jenner/code/treesitter-chunker/chunker/export/formats/semantic_lens.py` - Exporter implementation
- `/home/jenner/code/semantic-lens/fixtures/semantic-lens-v4.slb` - Fixture data
- `/home/jenner/code/semantic-lens/demo.html` - Visualization (with new data quality indicators)

## References

- Issue #003: 3D Graph Visualization (may help with dense/disconnected views)
- Issue #004: Semantic Zoom (clustering could group orphaned nodes)
