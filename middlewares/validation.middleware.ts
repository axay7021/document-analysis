import type { NextFunction, Request, Response } from 'express'
import type Joi from 'joi'

import httpResponse from '../utils/httpResponse'
import logger from '../utils/logger'

// Validation target types
type ValidationTarget = 'body' | 'params' | 'query'

// Validation error interface
interface ValidationError {
  field: string
  message: string
}

/**
 * Validation middleware factory for Joi schemas
 */
export const validate =
  (schema: Joi.ObjectSchema, target: ValidationTarget = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate: unknown = req[target] as unknown
      const validationResult = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
      })

      if (validationResult.error) {
        const validationErrors: ValidationError[] =
          validationResult.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
          }))

        logger.warn('Validation failed:', {
          target,
          errors: validationErrors,
          originalData: dataToValidate,
        })

        httpResponse(req, res, 400, 'Validation failed', {
          errors: validationErrors,
        })
        return
      }

      // Replace the original data with validated and sanitized data
      ;(req as unknown as Record<string, unknown>)[target] =
        validationResult.value
      next()
    } catch (validationError) {
      logger.error('Validation middleware error:', validationError)
      httpResponse(req, res, 500, 'Internal validation error')
    }
  }

/**
 * Validate request body
 */
export const validateBody = (schema: Joi.ObjectSchema) =>
  validate(schema, 'body')

/**
 * Validate request parameters
 */
export const validateParams = (schema: Joi.ObjectSchema) =>
  validate(schema, 'params')

/**
 * Validate query parameters
 */
export const validateQuery = (schema: Joi.ObjectSchema) =>
  validate(schema, 'query')
