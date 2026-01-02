/**
 * Bundle loader - transforms validated SemanticGraphBundle into graph operations.
 */

import type { SemanticGraphBundle } from '../schema/types.js';
import type { GraphStore } from './store.js';
import { validateBundle, type ValidationResult } from '../schema/validator.js';
import { GraphStoreError } from './store.js';

/**
 * Options for loading a bundle into a store.
 */
export interface LoadOptions {
  /** Whether to validate the bundle before loading (default: true) */
  validate?: boolean;
  /** Whether to clear the store before loading (default: false) */
  clearFirst?: boolean;
  /** Progress callback for large bundles */
  onProgress?: ProgressCallback;
}

/**
 * Progress callback type.
 */
export type ProgressCallback = (progress: LoadProgress) => void;

/**
 * Progress information during bundle loading.
 */
export interface LoadProgress {
  /** Current phase: 'validating', 'nodes', 'edges', 'annotations', 'patterns' */
  phase: 'validating' | 'nodes' | 'edges' | 'annotations' | 'patterns';
  /** Items processed in current phase */
  current: number;
  /** Total items in current phase */
  total: number;
  /** Percentage complete (0-100) */
  percent: number;
}

/**
 * Result of a bundle load operation.
 */
export interface LoadResult {
  /** Whether the load completed successfully */
  success: boolean;
  /** Number of nodes loaded */
  nodesLoaded: number;
  /** Number of edges loaded */
  edgesLoaded: number;
  /** Number of annotations loaded */
  annotationsLoaded: number;
  /** Number of patterns loaded */
  patternsLoaded: number;
  /** Duration in milliseconds */
  duration: number;
  /** Errors encountered during loading */
  errors?: string[];
}

/**
 * Load a SemanticGraphBundle into a GraphStore.
 *
 * @param store - The graph store to load into
 * @param bundle - The bundle to load (will be validated if not disabled)
 * @param options - Loading options
 * @returns Load result with counts and timing
 * @throws GraphStoreError if validation fails and validate option is true
 */
export async function loadBundleToStore(
  store: GraphStore,
  bundle: unknown,
  options: LoadOptions = {}
): Promise<LoadResult> {
  const { validate = true, clearFirst = false, onProgress } = options;
  const startTime = performance.now();
  const errors: string[] = [];

  let nodesLoaded = 0;
  let edgesLoaded = 0;
  let annotationsLoaded = 0;
  let patternsLoaded = 0;

  // Validate bundle if requested
  if (validate) {
    onProgress?.({
      phase: 'validating',
      current: 0,
      total: 1,
      percent: 0,
    });

    const validationResult: ValidationResult = validateBundle(bundle);

    if (!validationResult.valid) {
      const errorMessages = validationResult.errors?.map(
        (e) => `${e.path}: ${e.message}`
      ) || ['Unknown validation error'];

      throw new GraphStoreError(
        `Bundle validation failed: ${errorMessages.join('; ')}`,
        'INVALID_BUNDLE'
      );
    }

    onProgress?.({
      phase: 'validating',
      current: 1,
      total: 1,
      percent: 100,
    });
  }

  // Type assertion after validation
  const validBundle = bundle as SemanticGraphBundle;

  // Clear store if requested
  if (clearFirst) {
    await store.clear();
  }

  // Load nodes first (edges depend on them)
  const totalNodes = validBundle.nodes.length;
  for (let i = 0; i < validBundle.nodes.length; i++) {
    const node = validBundle.nodes[i];
    try {
      await store.addNode(node!);
      nodesLoaded++;
    } catch (error) {
      if (error instanceof GraphStoreError && error.code === 'DUPLICATE_NODE') {
        errors.push(`Duplicate node: ${node!.node_id}`);
      } else {
        throw error;
      }
    }

    if (onProgress && i % 100 === 0) {
      onProgress({
        phase: 'nodes',
        current: i + 1,
        total: totalNodes,
        percent: Math.round(((i + 1) / totalNodes) * 100),
      });
    }
  }

  onProgress?.({
    phase: 'nodes',
    current: totalNodes,
    total: totalNodes,
    percent: 100,
  });

  // Load edges
  const totalEdges = validBundle.edges.length;
  for (let i = 0; i < validBundle.edges.length; i++) {
    const edge = validBundle.edges[i];
    try {
      await store.addEdge(edge!);
      edgesLoaded++;
    } catch (error) {
      if (error instanceof GraphStoreError) {
        if (error.code === 'DUPLICATE_EDGE') {
          errors.push(`Duplicate edge: ${edge!.edge_id}`);
        } else if (error.code === 'INVALID_REFERENCE') {
          errors.push(`Invalid edge reference: ${edge!.edge_id} (${edge!.src} -> ${edge!.dst})`);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (onProgress && i % 100 === 0) {
      onProgress({
        phase: 'edges',
        current: i + 1,
        total: totalEdges,
        percent: Math.round(((i + 1) / totalEdges) * 100),
      });
    }
  }

  onProgress?.({
    phase: 'edges',
    current: totalEdges,
    total: totalEdges,
    percent: 100,
  });

  // Load annotations
  const totalAnnotations = validBundle.annotations.length;
  for (let i = 0; i < validBundle.annotations.length; i++) {
    const annotation = validBundle.annotations[i];
    try {
      await store.addAnnotation(annotation!);
      annotationsLoaded++;
    } catch (error) {
      if (error instanceof GraphStoreError && error.code === 'INVALID_REFERENCE') {
        errors.push(`Invalid annotation target: ${annotation!.target_id}`);
      } else {
        throw error;
      }
    }

    if (onProgress && i % 100 === 0) {
      onProgress({
        phase: 'annotations',
        current: i + 1,
        total: totalAnnotations,
        percent: Math.round(((i + 1) / totalAnnotations) * 100),
      });
    }
  }

  onProgress?.({
    phase: 'annotations',
    current: totalAnnotations,
    total: totalAnnotations,
    percent: 100,
  });

  // Load patterns
  const totalPatterns = validBundle.patterns.length;
  for (let i = 0; i < validBundle.patterns.length; i++) {
    const pattern = validBundle.patterns[i];
    try {
      await store.addPattern(pattern!);
      patternsLoaded++;
    } catch (error) {
      errors.push(`Failed to load pattern: ${pattern!.instance_id}`);
    }

    if (onProgress && i % 100 === 0) {
      onProgress({
        phase: 'patterns',
        current: i + 1,
        total: totalPatterns,
        percent: Math.round(((i + 1) / totalPatterns) * 100),
      });
    }
  }

  onProgress?.({
    phase: 'patterns',
    current: totalPatterns,
    total: totalPatterns,
    percent: 100,
  });

  const duration = performance.now() - startTime;

  return {
    success: errors.length === 0,
    nodesLoaded,
    edgesLoaded,
    annotationsLoaded,
    patternsLoaded,
    duration,
    errors: errors.length > 0 ? errors : undefined,
  };
}
