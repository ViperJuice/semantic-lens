/**
 * View state management for the Sigma.js viewer.
 * Tracks LOD level, selection, visibility, and edge mode.
 */

/**
 * Level of Detail modes for semantic zoom.
 * - overview: Zoomed out, see clusters and major structures
 * - structure: Medium zoom, see module/class boundaries
 * - detail: Zoomed in, see all nodes and labels
 */
export type LODLevel = 'overview' | 'structure' | 'detail';

/**
 * Edge visibility modes.
 * - selection: Only show edges connected to selected nodes (default, no hairball)
 * - all: Show all edges (can be overwhelming)
 * - none: Hide all edges
 */
export type EdgeMode = 'selection' | 'all' | 'none';

/**
 * Complete view state for the graph visualization.
 */
export interface ViewState {
  /** Current level of detail based on zoom */
  lod: LODLevel;
  /** Edge visibility mode */
  edgeMode: EdgeMode;
  /** Currently selected node IDs */
  selectedNodes: Set<string>;
  /** Temporarily hidden node IDs (can be restored) */
  hiddenNodes: Set<string>;
  /** Permanently deleted node IDs (for this session) */
  deletedNodes: Set<string>;
  /** Expanded cluster IDs (show internal structure) */
  expandedClusters: Set<string>;
  /** Collapsed cluster IDs (show as single node) */
  collapsedClusters: Set<string>;
  /** Whether to show isolate nodes */
  showIsolates: boolean;
  /** Whether to hide edges crossing cluster boundaries */
  hideExternalEdges: boolean;
}

/**
 * Creates the initial view state with sensible defaults.
 */
export function createInitialState(): ViewState {
  return {
    lod: 'overview',
    edgeMode: 'selection', // Default to selection-based (no hairball)
    selectedNodes: new Set(),
    hiddenNodes: new Set(),
    deletedNodes: new Set(),
    expandedClusters: new Set(),
    collapsedClusters: new Set(),
    showIsolates: true,
    hideExternalEdges: false,
  };
}

/**
 * Sigma camera ratio to LOD level mapping.
 * Camera ratio is inverse of visual zoom (higher = zoomed out).
 */
export function getLODFromZoom(cameraRatio: number): LODLevel {
  // cameraRatio > 1 = zoomed out, cameraRatio < 1 = zoomed in
  if (cameraRatio > 2.0) return 'overview';
  if (cameraRatio > 0.5) return 'structure';
  return 'detail';
}

/**
 * Gets the zoom ratio for a given LOD level (for programmatic zoom).
 */
export function getZoomForLOD(lod: LODLevel): number {
  switch (lod) {
    case 'overview':
      return 3.0;
    case 'structure':
      return 1.0;
    case 'detail':
      return 0.3;
  }
}

/**
 * Node size scaling based on LOD level.
 */
export function getNodeSizeForLOD(lod: LODLevel, baseSize: number = 5): number {
  switch (lod) {
    case 'overview':
      return baseSize * 0.8;
    case 'structure':
      return baseSize;
    case 'detail':
      return baseSize * 1.5;
  }
}

/**
 * Label visibility settings per LOD level.
 */
export interface LabelSettings {
  /** Whether labels are rendered at all */
  show: boolean;
  /** Minimum node size for label to be shown */
  sizeThreshold: number;
  /** Font size in pixels */
  fontSize: number;
}

export function getLabelSettingsForLOD(lod: LODLevel): LabelSettings {
  switch (lod) {
    case 'overview':
      return { show: true, sizeThreshold: 12, fontSize: 10 };
    case 'structure':
      return { show: true, sizeThreshold: 6, fontSize: 12 };
    case 'detail':
      return { show: true, sizeThreshold: 0, fontSize: 14 };
  }
}

/**
 * Serializes ViewState for snapshot export.
 * Converts Sets to arrays for JSON serialization.
 */
export function serializeViewState(
  state: ViewState
): Record<string, unknown> {
  return {
    lod: state.lod,
    edgeMode: state.edgeMode,
    selectedNodes: Array.from(state.selectedNodes),
    hiddenNodes: Array.from(state.hiddenNodes),
    deletedNodes: Array.from(state.deletedNodes),
    expandedClusters: Array.from(state.expandedClusters),
    collapsedClusters: Array.from(state.collapsedClusters),
    showIsolates: state.showIsolates,
    hideExternalEdges: state.hideExternalEdges,
  };
}

/**
 * Deserializes ViewState from a snapshot.
 */
export function deserializeViewState(
  data: Record<string, unknown>
): ViewState {
  return {
    lod: (data.lod as LODLevel) ?? 'overview',
    edgeMode: (data.edgeMode as EdgeMode) ?? 'selection',
    selectedNodes: new Set((data.selectedNodes as string[]) ?? []),
    hiddenNodes: new Set((data.hiddenNodes as string[]) ?? []),
    deletedNodes: new Set((data.deletedNodes as string[]) ?? []),
    expandedClusters: new Set((data.expandedClusters as string[]) ?? []),
    collapsedClusters: new Set((data.collapsedClusters as string[]) ?? []),
    showIsolates: (data.showIsolates as boolean) ?? true,
    hideExternalEdges: (data.hideExternalEdges as boolean) ?? false,
  };
}
