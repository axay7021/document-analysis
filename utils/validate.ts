import type { NextFunction, Request, Response } from 'express'
import type { ObjectSchema } from 'joi'

import httpResponse from './httpResponse'

export const validate =
  (schema: ObjectSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false })

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message)

      httpResponse(req, res, 400, errorMessages[0], {
        messages: errorMessages,
      })
      return
    }

    next()
  }
