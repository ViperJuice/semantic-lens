/**
 * Cypher Query Compiler
 * Compiles pattern definitions to Cypher queries for Memgraph/Neo4j.
 */

import type {
  PatternDefinition,
  RoleSpec,
  Constraint,
  EdgeConstraint,
  GroupConstraint,
  OptionalConstraint,
} from '../types.js';
import {
  isEdgeConstraint,
  isGroupConstraint,
  isOptionalConstraint,
} from '../types.js';

/**
 * Compiler for converting pattern definitions to Cypher queries.
 */
export class CypherCompiler {
  /**
   * Compile a pattern definition to a Cypher query.
   * @param pattern - Pattern definition to compile
   * @returns Cypher query string
   */
  compile(pattern: PatternDefinition): string {
    const lines: string[] = [];

    // Generate MATCH clauses for roles
    const roleMatches = this.compileRoles(pattern.roles);
    lines.push(roleMatches);

    // Separate required and optional constraints
    const requiredConstraints: Constraint[] = [];
    const optionalConstraints: OptionalConstraint[] = [];

    for (const constraint of pattern.constraints) {
      if (isOptionalConstraint(constraint)) {
        optionalConstraints.push(constraint);
      } else {
        requiredConstraints.push(constraint);
      }
    }

    // Generate MATCH/WHERE clauses for required edge constraints
    const edgeMatches = this.compileEdgeConstraints(
      requiredConstraints.filter(isEdgeConstraint)
    );
    if (edgeMatches) {
      lines.push(edgeMatches);
    }

    // Generate WITH clause for group constraints (collect + size check)
    const groupClause = this.compileGroupConstraints(
      requiredConstraints.filter(isGroupConstraint),
      pattern.roles
    );
    if (groupClause) {
      lines.push(groupClause);
    }

    // Generate OPTIONAL MATCH for optional constraints
    const optionalMatches = this.compileOptionalConstraints(optionalConstraints);
    if (optionalMatches) {
      lines.push(optionalMatches);
    }

    // Generate RETURN clause
    const returnClause = this.compileReturn(pattern);
    lines.push(returnClause);

    return lines.join('\n');
  }

  /**
   * Compile role specifications to MATCH clauses.
   */
  compileRoles(roles: Record<string, RoleSpec>): string {
    const matches: string[] = [];

    // Track which roles are owned by others
    const ownedRoles = new Map<string, string>();
    for (const [name, spec] of Object.entries(roles)) {
      if (spec.owned_by) {
        ownedRoles.set(name, spec.owned_by);
      }
    }

    // Generate MATCH for standalone roles first
    for (const [name, spec] of Object.entries(roles)) {
      if (!spec.owned_by) {
        const nodeMatch = this.compileNodeMatch(name, spec);
        matches.push(nodeMatch);
      }
    }

    // Generate MATCH for owned roles with DEFINES relationship
    for (const [name, spec] of Object.entries(roles)) {
      if (spec.owned_by) {
        const owner = spec.owned_by;
        const nodeMatch = this.compileNodeMatch(name, spec);
        // Add DEFINES relationship from owner
        matches.push(`MATCH (${owner})-[:DEFINES]->(${name}:Sym ${this.compileNodeProperties(spec)})`);
      }
    }

    return matches.join('\n');
  }

  /**
   * Compile constraints to WHERE/MATCH clauses.
   */
  compileConstraints(constraints: Constraint[]): string {
    const parts: string[] = [];

    for (const constraint of constraints) {
      if (isEdgeConstraint(constraint)) {
        parts.push(this.compileEdgeConstraint(constraint));
      } else if (isGroupConstraint(constraint)) {
        parts.push(this.compileGroupConstraint(constraint));
      } else if (isOptionalConstraint(constraint)) {
        parts.push(this.compileOptionalConstraint(constraint));
      }
    }

    return parts.join('\n');
  }

  private compileNodeMatch(name: string, spec: RoleSpec): string {
    const props = this.compileNodeProperties(spec);
    return `MATCH (${name}:Sym ${props})`;
  }

  private compileNodeProperties(spec: RoleSpec): string {
    const props: string[] = [`kind: '${spec.kind}'`];

    if (spec.name) {
      if (spec.name instanceof RegExp) {
        // Regex will be handled in WHERE clause
      } else {
        props.push(`name: '${spec.name}'`);
      }
    }

    return `{${props.join(', ')}}`;
  }

  private compileEdgeConstraints(constraints: EdgeConstraint[]): string {
    const matches: string[] = [];

    for (const constraint of constraints) {
      matches.push(this.compileEdgeConstraint(constraint));
    }

    return matches.join('\n');
  }

  private compileEdgeConstraint(constraint: EdgeConstraint): string {
    const relType = constraint.kind.toUpperCase();
    const targets = Array.isArray(constraint.to) ? constraint.to : [constraint.to];

    if (targets.length === 1) {
      let match = `MATCH (${constraint.from})-[r_${constraint.from}_${targets[0]}:${relType}]->(${targets[0]})`;

      if (constraint.minConfidence !== undefined) {
        match += `\nWHERE r_${constraint.from}_${targets[0]}.confidence >= ${constraint.minConfidence}`;
      }

      return match;
    } else {
      // Multiple targets - use WHERE with OR
      const conditions = targets.map(
        (t) => `(${constraint.from})-[:${relType}]->(${t})`
      );
      return `WHERE ${conditions.join(' OR ')}`;
    }
  }

  private compileGroupConstraints(
    constraints: GroupConstraint[],
    roles: Record<string, RoleSpec>
  ): string {
    if (constraints.length === 0) return '';

    const collects: string[] = [];
    const whereClauses: string[] = [];

    // Build list of all role variables to keep
    const allRoles = Object.keys(roles);

    for (const constraint of constraints) {
      collects.push(`collect(DISTINCT ${constraint.role}) AS ${constraint.role}s`);
      whereClauses.push(`size(${constraint.role}s) >= ${constraint.min_size}`);

      if (constraint.max_size !== undefined) {
        whereClauses.push(`size(${constraint.role}s) <= ${constraint.max_size}`);
      }
    }

    // Keep non-grouped roles
    const groupedRoles = new Set(constraints.map((c) => c.role));
    const keptRoles = allRoles.filter((r) => !groupedRoles.has(r));

    const withParts = [...keptRoles, ...collects];

    return `WITH ${withParts.join(', ')}\nWHERE ${whereClauses.join(' AND ')}`;
  }

  private compileGroupConstraint(constraint: GroupConstraint): string {
    let clause = `// Group: ${constraint.role} (min: ${constraint.min_size})`;
    if (constraint.max_size !== undefined) {
      clause += ` (max: ${constraint.max_size})`;
    }
    return clause;
  }

  private compileOptionalConstraints(constraints: OptionalConstraint[]): string {
    const matches: string[] = [];

    for (const constraint of constraints) {
      matches.push(this.compileOptionalConstraint(constraint));
    }

    return matches.join('\n');
  }

  private compileOptionalConstraint(constraint: OptionalConstraint): string {
    const inner = constraint.constraint;

    if (isEdgeConstraint(inner)) {
      const relType = inner.kind.toUpperCase();
      const target = Array.isArray(inner.to) ? inner.to[0] : inner.to;
      const bindAs = constraint.bind_as || target;

      return `OPTIONAL MATCH (${inner.from})-[:${relType}]->(${bindAs}:Sym)`;
    } else if (isGroupConstraint(inner)) {
      return `// Optional group: ${inner.role}`;
    }

    return '';
  }

  private compileReturn(pattern: PatternDefinition): string {
    const returns: string[] = [];

    for (const role of Object.keys(pattern.roles)) {
      returns.push(`${role}.node_id AS ${role}_id`);
    }

    // Add scoring if configured
    if (pattern.scoring.weights && Object.keys(pattern.scoring.weights).length > 0) {
      const scoreExpr = this.compileScoreExpression(pattern);
      returns.push(`(${scoreExpr}) AS confidence`);
    } else {
      returns.push(`${pattern.scoring.base} AS confidence`);
    }

    return `RETURN ${returns.join(', ')}`;
  }

  private compileScoreExpression(pattern: PatternDefinition): string {
    const parts: string[] = [`${pattern.scoring.base}`];

    // Add weighted contributions from constraints
    // This is a simplified version - real implementation would need
    // to check which constraints are satisfied
    for (const [name, weight] of Object.entries(pattern.scoring.weights)) {
      parts.push(`+ CASE WHEN true THEN ${weight} ELSE 0 END`);
    }

    return parts.join(' ');
  }
}

/**
 * Create a new Cypher compiler instance.
 */
export function createCypherCompiler(): CypherCompiler {
  return new CypherCompiler();
}
