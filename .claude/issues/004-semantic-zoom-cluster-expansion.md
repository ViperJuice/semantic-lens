# Issue #004: Semantic Zoom with Cluster Expansion

**Type**: Feature Enhancement
**Priority**: High
**Status**: Open

## Problem

When zooming into dense clusters, nodes remain overlapped and labels unreadable. Users must manually drag nodes apart to see details. This is tedious and doesn't scale.

**Desired behavior**: As user zooms in on a cluster, nodes should automatically spread apart to reveal details - similar to how Google Maps shows more detail as you zoom in.

## Research Summary

### What is Semantic Zoom?

Semantic zoom changes the *content* displayed based on zoom level, not just the *scale*:
- Zoomed out: Show summarized/clustered view
- Zoomed in: Show detailed individual nodes
- Transitions happen automatically based on zoom level

### Reference Implementation: NaviClusterCS

**Paper**: https://ncbi.nlm.nih.gov/pmc/articles/PMC3521214

NaviClusterCS for Cytoscape provides "Google Maps-like" navigation for large networks:
- Automatically identifies biologically meaningful clusters
- Displays only cluster representatives when zoomed out
- Double-click on cluster to zoom in and expand
- Handles graphs up to 100,000 nodes

**Key concepts:**
- Two-stage clustering algorithm
- Level-of-detail based on zoom
- Cluster nodes represent aggregated children
- Smooth transitions between zoom levels

### Level of Detail (LOD) in Cytoscape Desktop

Cytoscape desktop uses LOD rendering for performance:
- Node labels only shown when < 200 nodes visible
- Edge details hidden during pan/zoom interaction
- Automatically adjusts based on visible node count

### yFiles Node Overlap Avoidance

**Demo**: https://live.yworks.com/demos/layout/nodeoverlapavoiding/

Commercial library (yFiles) provides:
- ClearAreaLayout automatically pushes nodes apart
- Works during interactive editing
- Nodes move to avoid overlaps when one is enlarged

## Implementation Approaches

### Approach A: Zoom-triggered Cluster Expansion (Recommended)

Listen to zoom events and dynamically show/hide nodes:

```javascript
cy.on('zoom', function() {
  const zoomLevel = cy.zoom();

  if (zoomLevel > DETAIL_THRESHOLD) {
    // Show all nodes in visible clusters
    expandVisibleClusters();
  } else {
    // Collapse to cluster representatives
    collapseToClusterView();
  }
});
```

**Implementation steps:**
1. Pre-compute clusters using community detection
2. Create cluster "super-nodes" representing each cluster
3. Store mapping: cluster -> member nodes
4. On zoom in: replace cluster node with expanded members
5. On zoom out: collapse members back to cluster node

### Approach B: Viewport-based Detail Loading

Only load/show nodes that are in current viewport:

```javascript
cy.on('viewport', debounce(() => {
  const extent = cy.extent();  // visible bounding box

  // Hide nodes outside viewport
  cy.nodes().forEach(node => {
    const pos = node.position();
    if (isOutsideExtent(pos, extent)) {
      node.hide();
    } else {
      node.show();
    }
  });
}, 100));
```

### Approach C: Dynamic Re-layout on Zoom

Re-run layout algorithm on zoom with different parameters:

```javascript
cy.on('zoom', debounce(() => {
  const zoomLevel = cy.zoom();

  // Adjust repulsion based on zoom
  const repulsion = BASE_REPULSION * zoomLevel;

  cy.layout({
    name: 'fcose',
    nodeRepulsion: repulsion,
    // ... other params
  }).run();
}, 200));
```

## Technical Requirements

1. **Cluster Detection**: Use existing edge data or implement community detection
2. **Compound Nodes**: Use Cytoscape compound nodes for cluster representation
3. **Smooth Transitions**: Animate node expansion/collapse
4. **Performance**: Debounce zoom events, use requestAnimationFrame
5. **State Management**: Track which clusters are expanded/collapsed

## Cytoscape.js APIs Needed

```javascript
// Compound nodes for clusters
cy.add({
  data: { id: 'cluster1' },
  classes: 'cluster'
});

// Child nodes
cy.add({
  data: { id: 'node1', parent: 'cluster1' }
});

// Expand/collapse
cy.$('#cluster1').children().show();
cy.$('#cluster1').children().hide();

// Zoom events
cy.on('zoom', callback);

// Viewport extent
cy.extent();  // { x1, y1, x2, y2, w, h }
```

## Acceptance Criteria

- [ ] Zooming in on a cluster automatically reveals individual nodes
- [ ] Zooming out collapses nodes back to cluster summary
- [ ] Transitions are smooth (animated)
- [ ] Node labels become readable when zoomed in
- [ ] Performance remains acceptable (< 100ms per zoom step)
- [ ] User can still manually expand/collapse clusters

## References

- NaviClusterCS: https://ncbi.nlm.nih.gov/pmc/articles/PMC3521214
- Cytoscape.js compound nodes: https://js.cytoscape.org/#notation/compound-nodes
- Cytoscape.js events: https://js.cytoscape.org/#events
- yFiles overlap avoidance: https://live.yworks.com/demos/layout/nodeoverlapavoiding/
- D3 semantic zoom example: https://observablehq.com/@d3/semantic-zoom
