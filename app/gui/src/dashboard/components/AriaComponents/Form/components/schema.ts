/**
 * @file
 *
 * Create a schema for a form
 */

import * as z from 'zod'
import type { SchemaCallback, TSchema } from './types.ts'

/**
 * Factory function to create a schema.
 */
export function createSchema<Schema extends TSchema>(callback: SchemaCallback<Schema>) {
  return callback(z)
}

export * as schema from 'zod'
