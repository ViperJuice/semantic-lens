# Issue #003: 3D Graph Visualization

**Type**: Feature Enhancement
**Priority**: Medium
**Status**: Open

## Problem

2D graph layouts struggle with dense node clusters - even with optimized force-directed algorithms, highly connected nodes overlap and become unreadable. Moving to 3D space provides an additional dimension for nodes to spread out naturally.

## Research Summary

### Recommended Library: 3d-force-graph

**Repository**: https://github.com/vasturiano/3d-force-graph

A WebGL/ThreeJS-based library that:
- Renders force-directed graphs in 3D space
- Handles thousands of nodes with hardware acceleration
- Provides "Google Maps-like" navigation in 3D
- Has React bindings (`react-force-graph-3d`)
- Also offers VR and AR versions

**Why 3D helps:**
- Nodes can spread in Z-axis, reducing 2D overlap
- Users can rotate to find clear viewing angles
- Depth perception helps understand cluster relationships
- WebGL provides smooth 60fps rendering

### Alternative: Reagraph

**Repository**: https://github.com/reaviz/reagraph

WebGL graph visualization for React with:
- Force-directed 2D and 3D layouts
- Edge bundling and clustering
- Lasso selection
- Path finding between nodes

## Implementation Approach

### Option A: Replace Cytoscape.js entirely
- Use 3d-force-graph for all views
- Lose some Cytoscape features (compound nodes, extensions)
- Simpler architecture

### Option B: Add 3D as an alternate view mode
- Keep Cytoscape for 2D views
- Add 3d-force-graph as "3D View" option
- More complex but preserves existing functionality

### Option C: Hybrid with data sync
- Cytoscape manages graph data/state
- 3d-force-graph handles 3D rendering
- Sync selection/highlighting between views

## Technical Requirements

1. **Dependencies**:
   ```bash
   npm install 3d-force-graph three
   # OR for React:
   npm install react-force-graph-3d
   ```

2. **Data conversion**: Transform Cytoscape elements to 3d-force-graph format:
   ```javascript
   // Cytoscape format
   { nodes: [{ data: { id, label } }], edges: [{ data: { source, target } }] }

   // 3d-force-graph format
   { nodes: [{ id, name }], links: [{ source, target }] }
   ```

3. **Container setup**: WebGL canvas with proper sizing

## Acceptance Criteria

- [ ] 3D view option available in demo.html
- [ ] Graph data renders correctly in 3D
- [ ] Camera controls (rotate, zoom, pan) work
- [ ] Node labels visible and readable
- [ ] Performance acceptable with 400+ nodes
- [ ] Can click nodes to see details

## References

- 3d-force-graph: https://github.com/vasturiano/3d-force-graph
- Reagraph: https://github.com/reaviz/reagraph
- Neo4j 3D visualization: https://neo4j.com/blog/developer/visualizing-graphs-in-3d-with-webgl/
- ccNetViz (WebGL 2D): https://helikarlab.github.io/ccNetViz/
