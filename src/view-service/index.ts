/**
 * View Service Module
 * Provides graph projection, layout, formatting, and HTTP API.
 */

// Types
export {
  ViewType,
  VIEW_TYPES,
  ViewConfig,
  VIEW_CONFIG_DEFAULTS,
  ProjectionResult,
  ViewResponse,
  ViewStats,
  Position,
  isValidViewType,
  isValidViewConfig,
  applyViewConfigDefaults,
  validateViewConfig,
} from './types.js';

// Projector
export { GraphProjector, createProjector } from './projector/index.js';

// Layout
export {
  ELKLayoutEngine,
  createELKLayoutEngine,
  findConnectedComponents,
  layoutWithComponents,
} from './layout/index.js';

// Formatter
export {
  CytoscapeNode,
  CytoscapeEdge,
  CytoscapeElements,
  CytoscapeFormatter,
  createFormatter,
} from './formatter/index.js';

// API
export { ViewServiceOptions, ViewServer, createViewServer } from './api/index.js';
