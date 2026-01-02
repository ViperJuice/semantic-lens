/**
 * In-Memory Pattern Matcher
 * Matches pattern definitions against a graph store using queries.
 */

import { randomUUID } from 'crypto';
import type { GraphStore, NodeQuery } from '../../graph/store.js';
import type { Node, Edge } from '../../schema/types.js';
import type {
  PatternDefinition,
  PatternMatch,
  RoleSpec,
  Constraint,
  ConstraintResult,
  RoleBindings,
} from '../types.js';
import {
  isEdgeConstraint,
  isGroupConstraint,
  isOptionalConstraint,
} from '../types.js';
import { PatternScorer, createPatternScorer } from '../scorer.js';

/**
 * Interface for pattern matching operations.
 */
export interface PatternMatcherInterface {
  loadDefinitions(patterns: PatternDefinition[]): void;
  getDefinitions(): PatternDefinition[];
  match(graph: GraphStore, scope?: string[]): Promise<PatternMatch[]>;
  matchPattern(graph: GraphStore, patternId: string): Promise<PatternMatch[]>;
}

/**
 * In-memory pattern matcher implementation.
 */
export class PatternMatcher implements PatternMatcherInterface {
  private definitions: Map<string, PatternDefinition> = new Map();
  private scorer: PatternScorer;

  constructor() {
    this.scorer = createPatternScorer();
  }

  /**
   * Load pattern definitions for matching.
   */
  loadDefinitions(patterns: PatternDefinition[]): void {
    for (const pattern of patterns) {
      this.definitions.set(pattern.id, pattern);
    }
  }

  /**
   * Get all loaded pattern definitions.
   */
  getDefinitions(): PatternDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Match all loaded patterns against a graph.
   */
  async match(graph: GraphStore, scope?: string[]): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    for (const pattern of this.definitions.values()) {
      const patternMatches = await this.matchPattern(graph, pattern.id, scope);
      matches.push(...patternMatches);
    }

    return matches;
  }

  /**
   * Match a specific pattern against a graph.
   */
  async matchPattern(
    graph: GraphStore,
    patternId: string,
    scope?: string[]
  ): Promise<PatternMatch[]> {
    const pattern = this.definitions.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    // Find candidates for each role
    const roleCandidates = await this.findRoleCandidates(graph, pattern, scope);

    // Generate all valid binding combinations
    const bindings = this.generateBindings(pattern, roleCandidates);

    // Evaluate constraints and score each binding
    const matches: PatternMatch[] = [];
    for (const binding of bindings) {
      const constraintResults = await this.evaluateConstraints(graph, pattern, binding);

      // Check if all required constraints are satisfied
      const requiredSatisfied = constraintResults
        .filter((r) => !isOptionalConstraint(r.constraint))
        .every((r) => r.satisfied);

      if (requiredSatisfied) {
        const { confidence, evidence, explain } = this.scorer.calculateConfidence(
          pattern,
          binding,
          constraintResults
        );

        matches.push({
          instanceId: randomUUID(),
          patternId: pattern.id,
          roles: binding,
          confidence,
          evidence,
          explain,
        });
      }
    }

    // Deduplicate matches (same set of nodes)
    return this.deduplicateMatches(matches);
  }

  /**
   * Find candidate nodes for each role.
   */
  private async findRoleCandidates(
    graph: GraphStore,
    pattern: PatternDefinition,
    scope?: string[]
  ): Promise<Map<string, Node[]>> {
    const candidates = new Map<string, Node[]>();

    for (const [roleName, roleSpec] of Object.entries(pattern.roles)) {
      const query: NodeQuery = { kind: roleSpec.kind };

      // Add name filter if specified
      if (roleSpec.name && typeof roleSpec.name === 'string') {
        query.name = roleSpec.name;
      }

      // Add additional query criteria
      if (roleSpec.query) {
        Object.assign(query, roleSpec.query);
      }

      let nodes = await graph.findNodes(query);

      // Filter by scope if provided
      if (scope && scope.length > 0) {
        const scopeSet = new Set(scope);
        nodes = nodes.filter((n) => scopeSet.has(n.node_id));
      }

      // Filter by name regex if specified
      if (roleSpec.name instanceof RegExp) {
        nodes = nodes.filter((n) => (roleSpec.name as RegExp).test(n.name));
      }

      candidates.set(roleName, nodes);
    }

    return candidates;
  }

  /**
   * Generate all valid binding combinations.
   */
  private generateBindings(
    pattern: PatternDefinition,
    roleCandidates: Map<string, Node[]>
  ): RoleBindings[] {
    const roles = Object.keys(pattern.roles);

    // Handle owned_by relationships
    const ownedBy = new Map<string, string>();
    for (const [roleName, roleSpec] of Object.entries(pattern.roles)) {
      if (roleSpec.owned_by) {
        ownedBy.set(roleName, roleSpec.owned_by);
      }
    }

    // Find group roles
    const groupRoles = new Set<string>();
    for (const constraint of pattern.constraints) {
      if (isGroupConstraint(constraint)) {
        groupRoles.add(constraint.role);
      }
    }

    // Generate combinations
    return this.generateCombinations(roles, roleCandidates, ownedBy, groupRoles);
  }

  /**
   * Recursive combination generator.
   */
  private generateCombinations(
    roles: string[],
    candidates: Map<string, Node[]>,
    ownedBy: Map<string, string>,
    groupRoles: Set<string>,
    current: RoleBindings = {},
    index: number = 0
  ): RoleBindings[] {
    if (index >= roles.length) {
      return [{ ...current }];
    }

    const role = roles[index];
    if (!role) {
      return [{ ...current }];
    }

    const roleCandidates = candidates.get(role) || [];

    if (roleCandidates.length === 0) {
      return [];
    }

    const results: RoleBindings[] = [];

    // Check if this role is constrained by owned_by
    const ownerRole = ownedBy.get(role);

    if (groupRoles.has(role)) {
      // For group roles, include all candidates as an array
      const nodeIds = roleCandidates.map((n) => n.node_id);
      current[role] = nodeIds;
      results.push(...this.generateCombinations(roles, candidates, ownedBy, groupRoles, current, index + 1));
    } else if (ownerRole && current[ownerRole]) {
      // Filter candidates by owner relationship
      // For now, accept all candidates (would need edge check in real impl)
      for (const node of roleCandidates) {
        current[role] = node.node_id;
        results.push(...this.generateCombinations(roles, candidates, ownedBy, groupRoles, current, index + 1));
      }
    } else {
      // Try each candidate
      for (const node of roleCandidates) {
        current[role] = node.node_id;
        results.push(...this.generateCombinations(roles, candidates, ownedBy, groupRoles, current, index + 1));
      }
    }

    return results;
  }

  /**
   * Evaluate all constraints for a binding.
   */
  private async evaluateConstraints(
    graph: GraphStore,
    pattern: PatternDefinition,
    binding: RoleBindings
  ): Promise<ConstraintResult[]> {
    const results: ConstraintResult[] = [];
    const weights = pattern.scoring.weights;

    for (const constraint of pattern.constraints) {
      const result = await this.evaluateConstraint(graph, constraint, binding, weights);
      results.push(result);
    }

    return results;
  }

  /**
   * Evaluate a single constraint.
   */
  private async evaluateConstraint(
    graph: GraphStore,
    constraint: Constraint,
    binding: RoleBindings,
    weights: Record<string, number>
  ): Promise<ConstraintResult> {
    if (isEdgeConstraint(constraint)) {
      return this.evaluateEdgeConstraint(graph, constraint, binding, weights);
    } else if (isGroupConstraint(constraint)) {
      return this.evaluateGroupConstraint(constraint, binding, weights);
    } else if (isOptionalConstraint(constraint)) {
      const innerResult = await this.evaluateConstraint(
        graph,
        constraint.constraint,
        binding,
        weights
      );
      return {
        constraint,
        satisfied: innerResult.satisfied,
        weight: innerResult.weight,
        evidence: innerResult.evidence,
      };
    }

    return { constraint, satisfied: false, weight: 0 };
  }

  /**
   * Evaluate an edge constraint.
   */
  private async evaluateEdgeConstraint(
    graph: GraphStore,
    constraint: Constraint & { type: 'edge' },
    binding: RoleBindings,
    weights: Record<string, number>
  ): Promise<ConstraintResult> {
    const fromId = binding[constraint.from];
    const toIds = Array.isArray(constraint.to) ? constraint.to : [constraint.to];

    if (!fromId || typeof fromId !== 'string') {
      return { constraint, satisfied: false, weight: 0 };
    }

    // Get edges from the source node
    const edges = await graph.getEdgesForNode(fromId, 'out');

    // Check if any edge matches the constraint
    let satisfied = false;
    let matchingEdges: Edge[] = [];

    for (const toRole of toIds) {
      const targetIds = binding[toRole];
      const targetIdSet = new Set(Array.isArray(targetIds) ? targetIds : [targetIds]);

      for (const edge of edges) {
        if (
          edge.kind === constraint.kind &&
          targetIdSet.has(edge.dst) &&
          (constraint.minConfidence === undefined || edge.confidence >= constraint.minConfidence)
        ) {
          satisfied = true;
          matchingEdges.push(edge);
        }
      }
    }

    // Determine weight
    const weightKey = `${constraint.from}_${constraint.kind}_${toIds.join('_')}`;
    const weight = weights[weightKey] || 0.1;

    return {
      constraint,
      satisfied,
      weight: satisfied ? weight : 0,
      evidence: satisfied
        ? `Found ${matchingEdges.length} ${constraint.kind} edge(s) from ${constraint.from}`
        : undefined,
    };
  }

  /**
   * Evaluate a group constraint.
   */
  private evaluateGroupConstraint(
    constraint: Constraint & { type: 'group' },
    binding: RoleBindings,
    weights: Record<string, number>
  ): ConstraintResult {
    const roleBinding = binding[constraint.role];
    const count = Array.isArray(roleBinding) ? roleBinding.length : 1;

    const minSatisfied = count >= constraint.min_size;
    const maxSatisfied = constraint.max_size === undefined || count <= constraint.max_size;
    const satisfied = minSatisfied && maxSatisfied;

    const weightKey = `group_${constraint.role}`;
    const weight = weights[weightKey] || weights['multiple_' + constraint.role + 's'] || 0.1;

    return {
      constraint,
      satisfied,
      weight: satisfied ? weight : 0,
      evidence: satisfied
        ? `Found ${count} ${constraint.role}(s) (min: ${constraint.min_size})`
        : undefined,
    };
  }

  /**
   * Remove duplicate matches (same set of node IDs).
   */
  private deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
    const seen = new Set<string>();
    const unique: PatternMatch[] = [];

    for (const match of matches) {
      // Create a signature from sorted role bindings
      const nodeIds = Object.values(match.roles)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .sort()
        .join(',');

      const signature = `${match.patternId}:${nodeIds}`;

      if (!seen.has(signature)) {
        seen.add(signature);
        unique.push(match);
      }
    }

    return unique;
  }
}

/**
 * Create a new pattern matcher instance.
 */
export function createPatternMatcher(): PatternMatcher {
  return new PatternMatcher();
}
