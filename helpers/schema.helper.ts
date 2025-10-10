import type { ObjectSchema } from 'joi'

// Create a base messages object
const baseMessages = {
  'object.unknown': '"{#label}" is not a permitted field.',
}

// Function to apply unknown false and base messages with proper typing
export const createSchema = <T>(schema: ObjectSchema<T>): ObjectSchema<T> =>
  schema.unknown(false).messages(baseMessages)
