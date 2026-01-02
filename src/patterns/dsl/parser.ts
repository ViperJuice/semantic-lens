/**
 * YAML DSL Parser for Pattern Definitions
 * Parses pattern definitions from YAML format into PatternDefinition objects.
 */

import { parse as parseYaml } from 'yaml';
import { readFile } from 'fs/promises';
import type {
  PatternDefinition,
  RoleSpec,
  Constraint,
  EdgeConstraint,
  GroupConstraint,
  OptionalConstraint,
  ScoringConfig,
} from '../types.js';
import { isValidPatternDefinition } from '../types.js';
import type { NodeKind, EdgeKind } from '../../constants.js';
import { NODE_KINDS, EDGE_KINDS } from '../../constants.js';

/**
 * Validation result from parsing.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Raw YAML structure for a pattern file.
 */
interface RawPatternFile {
  version?: string;
  patterns?: RawPattern[];
}

/**
 * Raw YAML structure for a single pattern.
 */
interface RawPattern {
  id?: string;
  name?: string;
  description?: string;
  roles?: Record<string, RawRoleSpec>;
  constraints?: RawConstraint[];
  scoring?: RawScoringConfig;
}

interface RawRoleSpec {
  kind?: string;
  owned_by?: string;
  name?: string;
}

interface RawConstraint {
  type?: string;
  kind?: string;
  from?: string;
  to?: string | string[];
  role?: string;
  min_size?: number;
  max_size?: number;
  constraint?: RawConstraint;
  bind_as?: string;
  minConfidence?: number;
}

interface RawScoringConfig {
  base?: number;
  weights?: Record<string, number>;
}

/**
 * DSL Parser for pattern definitions.
 */
export class DSLParser {
  /**
   * Parse a YAML string into pattern definitions.
   * @param yaml - YAML string to parse
   * @returns Array of parsed pattern definitions
   * @throws Error if YAML is invalid or pattern structure is wrong
   */
  parse(yaml: string): PatternDefinition[] {
    const raw = parseYaml(yaml) as RawPatternFile;

    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid YAML: expected an object');
    }

    // Handle single pattern vs multiple patterns
    if (Array.isArray(raw.patterns)) {
      return raw.patterns.map((p, i) => this.parsePattern(p, i));
    }

    // Check if this looks like a single pattern at the root (has roles field)
    if ('roles' in raw) {
      return [this.parsePattern(raw as unknown as RawPattern, 0)];
    }

    throw new Error('Invalid pattern file: expected "patterns" array or single pattern');
  }

  /**
   * Parse a pattern definition file.
   * @param filePath - Path to the YAML file
   * @returns Array of parsed pattern definitions
   */
  async parseFile(filePath: string): Promise<PatternDefinition[]> {
    const content = await readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Validate a parsed object as a pattern definition.
   * @param definition - Object to validate
   * @returns Validation result with any errors
   */
  validate(definition: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof definition !== 'object' || definition === null) {
      errors.push('Definition must be an object');
      return { valid: false, errors };
    }

    const def = definition as Record<string, unknown>;

    // Check required fields
    if (typeof def.id !== 'string' || def.id.length === 0) {
      errors.push('Pattern must have a non-empty "id" field');
    }

    if (typeof def.roles !== 'object' || def.roles === null) {
      errors.push('Pattern must have a "roles" object');
    } else {
      const roles = def.roles as Record<string, unknown>;
      for (const [name, role] of Object.entries(roles)) {
        const roleErrors = this.validateRoleSpec(role, name);
        errors.push(...roleErrors);
      }
    }

    if (!Array.isArray(def.constraints)) {
      errors.push('Pattern must have a "constraints" array');
    } else {
      for (let i = 0; i < def.constraints.length; i++) {
        const constraintErrors = this.validateConstraint(def.constraints[i], i);
        errors.push(...constraintErrors);
      }
    }

    if (typeof def.scoring !== 'object' || def.scoring === null) {
      errors.push('Pattern must have a "scoring" object');
    } else {
      const scoringErrors = this.validateScoringConfig(def.scoring);
      errors.push(...scoringErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  private parsePattern(raw: RawPattern, index: number): PatternDefinition {
    if (!raw.id) {
      throw new Error(`Pattern at index ${index} is missing required field "id"`);
    }

    if (!raw.roles || typeof raw.roles !== 'object') {
      throw new Error(`Pattern "${raw.id}" is missing required field "roles"`);
    }

    if (!raw.scoring) {
      throw new Error(`Pattern "${raw.id}" is missing required field "scoring"`);
    }

    const roles: Record<string, RoleSpec> = {};
    for (const [name, role] of Object.entries(raw.roles)) {
      roles[name] = this.parseRoleSpec(role, name, raw.id);
    }

    const patternId = raw.id;
    const constraints: Constraint[] = (raw.constraints || []).map((c, i) =>
      this.parseConstraint(c, i, patternId)
    );

    const scoring = this.parseScoringConfig(raw.scoring, raw.id);

    const pattern: PatternDefinition = {
      id: raw.id,
      roles,
      constraints,
      scoring,
    };

    if (raw.name) pattern.name = raw.name;
    if (raw.description) pattern.description = raw.description;

    // Final validation
    if (!isValidPatternDefinition(pattern)) {
      throw new Error(`Pattern "${raw.id}" failed final validation`);
    }

    return pattern;
  }

  private parseRoleSpec(raw: RawRoleSpec, name: string, patternId: string): RoleSpec {
    if (!raw.kind) {
      throw new Error(`Role "${name}" in pattern "${patternId}" is missing required field "kind"`);
    }

    if (!NODE_KINDS.includes(raw.kind as NodeKind)) {
      throw new Error(
        `Role "${name}" in pattern "${patternId}" has invalid kind "${raw.kind}". ` +
          `Valid kinds: ${NODE_KINDS.join(', ')}`
      );
    }

    const role: RoleSpec = {
      kind: raw.kind as NodeKind,
    };

    if (raw.owned_by) role.owned_by = raw.owned_by;

    if (raw.name) {
      // Check if it looks like a regex pattern
      if (raw.name.startsWith('/') && raw.name.includes('/', 1)) {
        const match = raw.name.match(/^\/(.+)\/([gimsuvy]*)$/);
        if (match && match[1]) {
          role.name = new RegExp(match[1], match[2] || '');
        } else {
          role.name = raw.name;
        }
      } else {
        role.name = raw.name;
      }
    }

    return role;
  }

  private parseConstraint(raw: RawConstraint, index: number, patternId: string): Constraint {
    if (!raw.type) {
      throw new Error(
        `Constraint at index ${index} in pattern "${patternId}" is missing required field "type"`
      );
    }

    switch (raw.type) {
      case 'edge':
        return this.parseEdgeConstraint(raw, index, patternId);
      case 'group':
        return this.parseGroupConstraint(raw, index, patternId);
      case 'optional':
        return this.parseOptionalConstraint(raw, index, patternId);
      default:
        throw new Error(
          `Constraint at index ${index} in pattern "${patternId}" has unknown type "${raw.type}"`
        );
    }
  }

  private parseEdgeConstraint(
    raw: RawConstraint,
    index: number,
    patternId: string
  ): EdgeConstraint {
    if (!raw.kind) {
      throw new Error(
        `Edge constraint at index ${index} in pattern "${patternId}" is missing "kind"`
      );
    }

    if (!EDGE_KINDS.includes(raw.kind as EdgeKind)) {
      throw new Error(
        `Edge constraint at index ${index} in pattern "${patternId}" has invalid kind "${raw.kind}". ` +
          `Valid kinds: ${EDGE_KINDS.join(', ')}`
      );
    }

    if (!raw.from) {
      throw new Error(
        `Edge constraint at index ${index} in pattern "${patternId}" is missing "from"`
      );
    }

    if (!raw.to) {
      throw new Error(
        `Edge constraint at index ${index} in pattern "${patternId}" is missing "to"`
      );
    }

    const constraint: EdgeConstraint = {
      type: 'edge',
      kind: raw.kind as EdgeKind,
      from: raw.from,
      to: raw.to,
    };

    if (raw.minConfidence !== undefined) {
      constraint.minConfidence = raw.minConfidence;
    }

    return constraint;
  }

  private parseGroupConstraint(
    raw: RawConstraint,
    index: number,
    patternId: string
  ): GroupConstraint {
    if (!raw.role) {
      throw new Error(
        `Group constraint at index ${index} in pattern "${patternId}" is missing "role"`
      );
    }

    if (typeof raw.min_size !== 'number' || raw.min_size < 1) {
      throw new Error(
        `Group constraint at index ${index} in pattern "${patternId}" must have min_size >= 1`
      );
    }

    const constraint: GroupConstraint = {
      type: 'group',
      role: raw.role,
      min_size: raw.min_size,
    };

    if (raw.max_size !== undefined) {
      constraint.max_size = raw.max_size;
    }

    return constraint;
  }

  private parseOptionalConstraint(
    raw: RawConstraint,
    index: number,
    patternId: string
  ): OptionalConstraint {
    if (!raw.constraint) {
      throw new Error(
        `Optional constraint at index ${index} in pattern "${patternId}" is missing "constraint"`
      );
    }

    const innerConstraint = this.parseConstraint(
      raw.constraint,
      index,
      patternId
    ) as EdgeConstraint | GroupConstraint;

    const constraint: OptionalConstraint = {
      type: 'optional',
      constraint: innerConstraint,
    };

    if (raw.bind_as) {
      constraint.bind_as = raw.bind_as;
    }

    return constraint;
  }

  private parseScoringConfig(raw: RawScoringConfig, patternId: string): ScoringConfig {
    if (typeof raw.base !== 'number') {
      throw new Error(`Pattern "${patternId}" scoring is missing "base" score`);
    }

    if (raw.base < 0 || raw.base > 1) {
      throw new Error(`Pattern "${patternId}" scoring base must be between 0 and 1`);
    }

    return {
      base: raw.base,
      weights: raw.weights || {},
    };
  }

  private validateRoleSpec(role: unknown, name: string): string[] {
    const errors: string[] = [];

    if (typeof role !== 'object' || role === null) {
      errors.push(`Role "${name}" must be an object`);
      return errors;
    }

    const r = role as Record<string, unknown>;

    if (typeof r.kind !== 'string') {
      errors.push(`Role "${name}" must have a "kind" field`);
    } else if (!NODE_KINDS.includes(r.kind as NodeKind)) {
      errors.push(`Role "${name}" has invalid kind "${r.kind}"`);
    }

    return errors;
  }

  private validateConstraint(constraint: unknown, index: number): string[] {
    const errors: string[] = [];

    if (typeof constraint !== 'object' || constraint === null) {
      errors.push(`Constraint at index ${index} must be an object`);
      return errors;
    }

    const c = constraint as Record<string, unknown>;

    if (typeof c.type !== 'string') {
      errors.push(`Constraint at index ${index} must have a "type" field`);
    }

    return errors;
  }

  private validateScoringConfig(scoring: unknown): string[] {
    const errors: string[] = [];

    if (typeof scoring !== 'object' || scoring === null) {
      errors.push('Scoring must be an object');
      return errors;
    }

    const s = scoring as Record<string, unknown>;

    if (typeof s.base !== 'number') {
      errors.push('Scoring must have a numeric "base" field');
    } else if (s.base < 0 || s.base > 1) {
      errors.push('Scoring base must be between 0 and 1');
    }

    return errors;
  }
}

/**
 * Create a new DSL parser instance.
 */
export function createDSLParser(): DSLParser {
  return new DSLParser();
}

/**
 * Parse a single YAML pattern definition string.
 * Convenience function that creates a parser and parses a single pattern.
 * @param yaml - YAML string defining a single pattern
 * @returns The parsed PatternDefinition
 * @throws Error if parsing fails or YAML contains multiple patterns
 */
export function parsePatternDefinition(yaml: string): PatternDefinition {
  const parser = new DSLParser();
  const patterns = parser.parse(yaml);

  if (patterns.length === 0) {
    throw new Error('No pattern definition found in YAML');
  }

  if (patterns.length > 1) {
    throw new Error('Expected single pattern, found multiple. Use createDSLParser().parse() instead.');
  }

  return patterns[0]!;
}
