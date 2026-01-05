/**
 * Sigma.js visualization module for Semantic Lens.
 * Provides WebGL-accelerated graph rendering for large codebases.
 */

// Graph building
export { buildGraph, getShortLabel, KIND_COLORS } from './buildGraph.js';
export type {
  BuildGraphOptions,
  BuildGraphResult,
  GraphNodeAttributes,
  GraphEdgeAttributes,
  SemanticGraph,
} from './buildGraph.js';

// View state
export {
  createInitialState,
  getLODFromZoom,
  getZoomForLOD,
  getNodeSizeForLOD,
  getLabelSettingsForLOD,
  serializeViewState,
  deserializeViewState,
} from './viewState.js';
export type { LODLevel, EdgeMode, ViewState, LabelSettings } from './viewState.js';

// Projection
export { projectGraph, applyProjection, getConnectedEdges, getNeighbors, findNodes } from './projection.js';
export type { ProjectionResult, NodeQuery } from './projection.js';

// Viewer
export { SemanticLensViewer } from './viewer.js';
export type { ViewerOptions, ViewerEvents } from './viewer.js';

// Snapshot
export { captureSnapshot, downloadSnapshot } from './snapshot.js';
export type { SnapshotOptions, JsonSnapshot, NodeSummary, NodeDetail } from './snapshot.js';
