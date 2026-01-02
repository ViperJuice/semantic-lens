/**
 * Pattern Engine Module
 * Provides pattern detection for semantic code graphs.
 */

import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createDSLParser } from './dsl/parser.js';
import type { PatternDefinition } from './types.js';

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

// Re-export matcher
export { PatternMatcher, createPatternMatcher } from './matcher/matcher.js';
export type { PatternMatcherInterface } from './matcher/matcher.js';

// Re-export scorer
export { PatternScorer, createPatternScorer } from './scorer.js';
export type { ScoringResult } from './scorer.js';

/**
 * Load built-in pattern definitions from the definitions directory.
 * @returns Promise resolving to array of pattern definitions
 */
export async function loadBuiltinPatterns(): Promise<PatternDefinition[]> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const definitionsDir = join(__dirname, 'definitions');

  const parser = createDSLParser();
  const patterns: PatternDefinition[] = [];

  try {
    const files = await readdir(definitionsDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of yamlFiles) {
      const filePath = join(definitionsDir, file);
      const filePatterns = await parser.parseFile(filePath);
      patterns.push(...filePatterns);
    }
  } catch (error) {
    // If definitions directory doesn't exist, return empty array
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return patterns;
}
