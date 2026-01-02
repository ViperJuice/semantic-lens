/**
 * Schema module public API.
 * Re-exports all types and validation functions.
 */

// Types
export type {
  SemanticGraphBundle,
  Node,
  Edge,
  Annotation,
  PatternInstance,
  Repo,
  Span,
} from './types.js';

// Validation
export {
  validateBundle,
  isValidBundle,
  getValidator,
  formatErrors,
  type ValidationResult,
  type ValidationError,
} from './validator.js';
