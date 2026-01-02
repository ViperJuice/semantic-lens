# Issue #002: Graph Views Unviewable on First Load

**Type**: Bug Fix
**Priority**: High
**Status**: Open

## Problem

When opening a graph view in `demo.html`, nodes appear stacked/invisible until manually refreshed or manipulated. The graph should auto-arrange on first view.

## Root Cause

In `demo.html`, Cytoscape is initialized with `layout: { name: 'preset' }` which expects nodes to have position data. But elements are created **without positions**, so all nodes stack at coordinates (0,0).

**Current Code (demo.html:379):**
```javascript
cy = cytoscape({
  container: document.getElementById('cy'),
  elements: elements,
  layout: { name: 'preset' },  // <-- Expects positions that don't exist!
  ...
});
```

**The Problem Flow:**
1. Cytoscape initialized with 'preset' layout (requires position data)
2. Elements have no position information
3. All nodes placed at (0,0) - appear stacked/invisible
4. Layout applied AFTER init, but user sees broken state first

## Fix

Change line 379 in `demo.html` from:
```javascript
layout: { name: 'preset' },
```
to:
```javascript
layout: { name: 'cose', animate: false },
```

**Why COSE:**
- Force-directed layout that auto-arranges nodes immediately
- Handles compound nodes well (used for file grouping)
- Built into Cytoscape, no additional dependencies
- Good performance for <1000 nodes (typical use case)
- Simpler than extracting ELK positions from API

## Files to Modify

- `/home/jenner/code/semantic-lens/demo.html:379` - Change layout from 'preset' to 'cose'

## Testing

1. Open demo.html in browser
2. Load a bundle
3. Verify nodes are auto-arranged immediately (not stacked at origin)
4. Verify different layout options in dropdown still work

## Related

- Issue #001: Tree-sitter language pack fallback
