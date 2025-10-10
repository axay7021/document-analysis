import type { NextFunction, Request, Response } from 'express'
import { ValidationError as JoiValidationError } from 'joi'

import type { THttpError } from '../types/types'

// Custom global error handler
export default (
  err: THttpError,
  _: Request,
  res: Response,
  __: NextFunction
): void => {
  if (err instanceof JoiValidationError) {
    // Extract error messages from Joi validation error
    const errorMessages = err.details.map((detail) => detail.message).join(', ')

    return void res.status(400).json({
      status: 'fail',
      message: errorMessages,
    })
  }

  // Handle other errors
  return void res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  })
}
