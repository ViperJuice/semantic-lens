/**
 * Pattern Confidence Scorer
 * Calculates confidence scores for pattern matches based on constraint satisfaction.
 */

import type {
  PatternDefinition,
  RoleBindings,
  ConstraintResult,
  Constraint,
} from './types.js';
import { isOptionalConstraint } from './types.js';

/**
 * Scoring result with confidence and evidence.
 */
export interface ScoringResult {
  /** Final confidence score (0-1) */
  confidence: number;
  /** Evidence strings describing what contributed to the score */
  evidence: string[];
  /** Explanation of how the score was calculated */
  explain: string;
}

/**
 * Pattern Confidence Scorer
 */
export class PatternScorer {
  /**
   * Calculate confidence score for a pattern match.
   * @param pattern - The pattern definition
   * @param bindings - Role bindings for the match
   * @param constraintResults - Results of constraint evaluation
   * @returns Scoring result with confidence and evidence
   */
  calculateConfidence(
    pattern: PatternDefinition,
    bindings: RoleBindings,
    constraintResults: ConstraintResult[]
  ): ScoringResult {
    const evidence: string[] = [];
    let score = pattern.scoring.base;

    // Add evidence for base score
    evidence.push(`Base score: ${pattern.scoring.base.toFixed(2)}`);

    // Track which weights have been applied
    const appliedWeights = new Map<string, number>();

    // Process each constraint result
    for (const result of constraintResults) {
      if (result.satisfied) {
        score += result.weight;

        const constraintName = this.getConstraintName(result.constraint);
        appliedWeights.set(constraintName, result.weight);

        if (result.evidence) {
          evidence.push(result.evidence);
        } else {
          evidence.push(`Constraint satisfied: ${constraintName} (+${result.weight.toFixed(2)})`);
        }
      } else if (!isOptionalConstraint(result.constraint)) {
        // Non-optional constraint failed
        evidence.push(`Constraint failed: ${this.getConstraintName(result.constraint)}`);
      }
    }

    // Clamp score to [0, 1]
    score = Math.max(0, Math.min(1, score));

    // Generate explanation
    const explain = this.generateExplanation(pattern, bindings, constraintResults, score);

    return {
      confidence: score,
      evidence,
      explain,
    };
  }

  /**
   * Generate a human-readable name for a constraint.
   */
  private getConstraintName(constraint: Constraint): string {
    switch (constraint.type) {
      case 'edge':
        const target = Array.isArray(constraint.to) ? constraint.to.join('|') : constraint.to;
        return `${constraint.from}->${target} (${constraint.kind})`;

      case 'group':
        return `group(${constraint.role}, min=${constraint.min_size})`;

      case 'optional':
        return `optional(${this.getConstraintName(constraint.constraint)})`;

      default:
        return 'unknown';
    }
  }

  /**
   * Generate a detailed explanation of the scoring.
   */
  private generateExplanation(
    pattern: PatternDefinition,
    bindings: RoleBindings,
    constraintResults: ConstraintResult[],
    finalScore: number
  ): string {
    const lines: string[] = [];

    lines.push(`Pattern: ${pattern.name || pattern.id}`);
    lines.push('');

    // Role bindings
    lines.push('Role Bindings:');
    for (const [role, nodeId] of Object.entries(bindings)) {
      if (Array.isArray(nodeId)) {
        lines.push(`  ${role}: [${nodeId.length} nodes]`);
      } else {
        lines.push(`  ${role}: ${nodeId}`);
      }
    }
    lines.push('');

    // Constraints
    lines.push('Constraints:');
    for (const result of constraintResults) {
      const name = this.getConstraintName(result.constraint);
      const status = result.satisfied ? 'PASS' : 'FAIL';
      const optional = isOptionalConstraint(result.constraint) ? ' (optional)' : '';
      lines.push(`  [${status}] ${name}${optional}`);
    }
    lines.push('');

    // Score breakdown
    lines.push('Score Breakdown:');
    lines.push(`  Base: ${pattern.scoring.base.toFixed(2)}`);

    let addedScore = 0;
    for (const result of constraintResults) {
      if (result.satisfied && result.weight > 0) {
        const name = this.getConstraintName(result.constraint);
        lines.push(`  + ${result.weight.toFixed(2)} (${name})`);
        addedScore += result.weight;
      }
    }

    lines.push(`  --------`);
    lines.push(`  Total: ${finalScore.toFixed(2)}`);

    return lines.join('\n');
  }
}

/**
 * Create a new pattern scorer instance.
 */
export function createPatternScorer(): PatternScorer {
  return new PatternScorer();
}
