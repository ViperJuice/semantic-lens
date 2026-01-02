/**
 * Validate Command
 * Validates a SemanticGraphBundle JSON file.
 */

import { readFile } from 'fs/promises';
import { validateBundle } from '../../schema/validator.js';

/**
 * Run the validate command.
 * @param filePath - Path to the bundle JSON file
 * @returns Exit code (0 = valid, 1 = invalid or error)
 */
export async function validateCommand(filePath: string): Promise<number> {
  try {
    // Read the file
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`);
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to parse JSON: ${filePath}`);
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }

    // Validate
    const result = validateBundle(data);

    if (result.valid) {
      console.log(`Valid: ${filePath}`);
      return 0;
    } else {
      console.error(`Validation failed: ${filePath}`);
      if (result.errors) {
        for (const error of result.errors) {
          console.error(`  ${error.path}: ${error.message}`);
        }
      }
      return 1;
    }
  } catch (error) {
    console.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
