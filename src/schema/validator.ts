/**
 * AJV-based validation for SemanticGraphBundle.
 * Provides runtime validation with clear error messages.
 */

import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import ajvFormats from 'ajv-formats';
import { createRequire } from 'module';
import type { SemanticGraphBundle } from './types.js';

// Load JSON schema using createRequire for proper ESM/CJS compat
const require = createRequire(import.meta.url);
const schema = require('./semantic-graph-bundle.schema.json') as object;

// Get the addFormats function (handles both ESM and CJS exports)
const addFormats = typeof ajvFormats === 'function' ? ajvFormats : ajvFormats.default;

/**
 * Result of bundle validation.
 */
export interface ValidationResult {
  /** Whether the bundle is valid */
  valid: boolean;
  /** Validation errors if invalid */
  errors?: ValidationError[];
}

/**
 * A single validation error with details.
 */
export interface ValidationError {
  /** JSON pointer path to the error location (e.g., "/nodes/0/kind") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** JSON Schema keyword that failed (e.g., "required", "enum") */
  keyword: string;
  /** Additional parameters from the validation */
  params?: Record<string, unknown>;
}

// Initialize AJV 2020-12 with all errors mode and strict checking
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictSchema: true,
  strictNumbers: true,
  strictTypes: true,
  strictTuples: true,
  strictRequired: true,
});

// Add format validators (date-time, uri, etc.)
addFormats(ajv);

// Compile the schema
const validate: ValidateFunction = ajv.compile(schema);

/**
 * Get the compiled AJV validator function.
 * Useful for advanced use cases or testing.
 */
export function getValidator(): ValidateFunction {
  return validate;
}

/**
 * Format AJV errors into our ValidationError structure.
 * Makes errors more readable and consistent.
 */
export function formatErrors(errors: ErrorObject[]): ValidationError[] {
  return errors.map((err) => ({
    path: err.instancePath || '/',
    message: err.message ?? 'Unknown validation error',
    keyword: err.keyword,
    params: err.params as Record<string, unknown> | undefined,
  }));
}

/**
 * Validate unknown data against the SemanticGraphBundle schema.
 *
 * @param data - The data to validate (unknown type)
 * @returns ValidationResult with valid flag and optional errors
 *
 * @example
 * ```typescript
 * const result = validateBundle(jsonData);
 * if (result.valid) {
 *   // data is valid, can safely cast to SemanticGraphBundle
 * } else {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export function validateBundle(data: unknown): ValidationResult {
  const valid = validate(data);

  if (valid) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: formatErrors(validate.errors ?? []),
  };
}

/**
 * Type guard that validates data and narrows the type to SemanticGraphBundle.
 *
 * @param data - The data to validate (unknown type)
 * @returns True if data is a valid SemanticGraphBundle
 *
 * @example
 * ```typescript
 * if (isValidBundle(data)) {
 *   // TypeScript knows data is SemanticGraphBundle here
 *   console.log(data.version);
 * }
 * ```
 */
export function isValidBundle(data: unknown): data is SemanticGraphBundle {
  return validateBundle(data).valid;
}
