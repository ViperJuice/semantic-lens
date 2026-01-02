/**
 * Pattern Engine Module
 * Provides pattern detection for semantic code graphs.
 */

// Re-export types
export type {
  RoleSpec,
  EdgeConstraint,
  GroupConstraint,
  OptionalConstraint,
  Constraint,
  ScoringConfig,
  PatternDefinition,
  PatternMatch,
  RoleBindings,
  ConstraintResult,
} from './types.js';

// Re-export type guards
export {
  isEdgeConstraint,
  isGroupConstraint,
  isOptionalConstraint,
  isValidRoleSpec,
  isValidScoringConfig,
  isValidPatternDefinition,
  isValidConstraint,
} from './types.js';

// Re-export DSL parser
export { DSLParser, createDSLParser } from './dsl/parser.js';
export type { ValidationResult } from './dsl/parser.js';

// Re-export Cypher compiler
export { CypherCompiler, createCypherCompiler } from './cypher/compiler.js';
