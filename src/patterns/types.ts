/**
 * Pattern Engine Types
 * Defines types and interfaces for pattern detection in semantic graphs.
 */

import type { NodeKind, EdgeKind } from '../constants.js';
import type { NodeQuery } from '../graph/store.js';

/**
 * Specification for a role in a pattern.
 * Defines what kind of node can fill this role.
 */
export interface RoleSpec {
  /** Required node kind */
  kind: NodeKind;
  /** Role this node must be owned by (via DEFINES edge) */
  owned_by?: string;
  /** Name pattern to match */
  name?: string | RegExp;
  /** Additional node query criteria */
  query?: Partial<NodeQuery>;
}

/**
 * Edge constraint - requires an edge between roles.
 */
export interface EdgeConstraint {
  type: 'edge';
  /** Edge kind required */
  kind: EdgeKind;
  /** Source role name */
  from: string;
  /** Target role name(s) */
  to: string | string[];
  /** Minimum confidence for the edge */
  minConfidence?: number;
}

/**
 * Group constraint - requires multiple nodes filling a role.
 */
export interface GroupConstraint {
  type: 'group';
  /** Role name to constrain */
  role: string;
  /** Minimum number of nodes */
  min_size: number;
  /** Maximum number of nodes (optional) */
  max_size?: number;
}

/**
 * Optional constraint - adds to score if satisfied but not required.
 */
export interface OptionalConstraint {
  type: 'optional';
  /** The constraint to optionally satisfy */
  constraint: EdgeConstraint | GroupConstraint;
  /** Bind result to a role name */
  bind_as?: string;
}

/**
 * Union of all constraint types.
 */
export type Constraint = EdgeConstraint | GroupConstraint | OptionalConstraint;

/**
 * Scoring configuration for a pattern.
 */
export interface ScoringConfig {
  /** Base confidence score (0-1) */
  base: number;
  /** Weight for each constraint (0-1, must sum to <= 1-base) */
  weights: Record<string, number>;
}

/**
 * Full pattern definition.
 */
export interface PatternDefinition {
  /** Unique pattern identifier */
  id: string;
  /** Human-readable pattern name */
  name?: string;
  /** Pattern description */
  description?: string;
  /** Role definitions */
  roles: Record<string, RoleSpec>;
  /** Constraints between roles */
  constraints: Constraint[];
  /** Scoring configuration */
  scoring: ScoringConfig;
}

/**
 * A detected pattern instance.
 */
export interface PatternMatch {
  /** Unique instance ID (generated) */
  instanceId: string;
  /** Pattern definition ID */
  patternId: string;
  /** Role bindings (role name -> node ID or array of node IDs) */
  roles: Record<string, string | string[]>;
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence for the match */
  evidence: string[];
  /** Human-readable explanation */
  explain?: string;
}

/**
 * Role bindings map role names to node IDs.
 */
export type RoleBindings = Record<string, string | string[]>;

/**
 * Result of evaluating a single constraint.
 */
export interface ConstraintResult {
  /** The constraint that was evaluated */
  constraint: Constraint;
  /** Whether the constraint was satisfied */
  satisfied: boolean;
  /** Weight applied to this constraint */
  weight: number;
  /** Additional evidence for this constraint */
  evidence?: string;
}

// Type guards for constraint types

/**
 * Check if a constraint is an edge constraint.
 */
export function isEdgeConstraint(c: Constraint): c is EdgeConstraint {
  return c.type === 'edge';
}

/**
 * Check if a constraint is a group constraint.
 */
export function isGroupConstraint(c: Constraint): c is GroupConstraint {
  return c.type === 'group';
}

/**
 * Check if a constraint is an optional constraint.
 */
export function isOptionalConstraint(c: Constraint): c is OptionalConstraint {
  return c.type === 'optional';
}

/**
 * Validate a RoleSpec object.
 */
export function isValidRoleSpec(obj: unknown): obj is RoleSpec {
  if (typeof obj !== 'object' || obj === null) return false;
  const role = obj as Record<string, unknown>;
  return typeof role.kind === 'string';
}

/**
 * Validate a ScoringConfig object.
 */
export function isValidScoringConfig(obj: unknown): obj is ScoringConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const config = obj as Record<string, unknown>;
  if (typeof config.base !== 'number') return false;
  if (config.base < 0 || config.base > 1) return false;
  if (typeof config.weights !== 'object' || config.weights === null) return false;
  const weights = config.weights as Record<string, unknown>;
  for (const [, value] of Object.entries(weights)) {
    if (typeof value !== 'number' || value < 0 || value > 1) return false;
  }
  return true;
}

/**
 * Validate a PatternDefinition object.
 */
export function isValidPatternDefinition(obj: unknown): obj is PatternDefinition {
  if (typeof obj !== 'object' || obj === null) return false;
  const pattern = obj as Record<string, unknown>;

  if (typeof pattern.id !== 'string' || pattern.id.length === 0) return false;
  if (typeof pattern.roles !== 'object' || pattern.roles === null) return false;
  if (!Array.isArray(pattern.constraints)) return false;
  if (!isValidScoringConfig(pattern.scoring)) return false;

  const roles = pattern.roles as Record<string, unknown>;
  for (const [, role] of Object.entries(roles)) {
    if (!isValidRoleSpec(role)) return false;
  }

  return true;
}

/**
 * Validate a Constraint object.
 */
export function isValidConstraint(obj: unknown): obj is Constraint {
  if (typeof obj !== 'object' || obj === null) return false;
  const constraint = obj as Record<string, unknown>;

  if (constraint.type === 'edge') {
    return (
      typeof constraint.kind === 'string' &&
      typeof constraint.from === 'string' &&
      (typeof constraint.to === 'string' || Array.isArray(constraint.to))
    );
  }

  if (constraint.type === 'group') {
    return (
      typeof constraint.role === 'string' &&
      typeof constraint.min_size === 'number' &&
      constraint.min_size >= 1
    );
  }

  if (constraint.type === 'optional') {
    return isValidConstraint(constraint.constraint);
  }

  return false;
}
