import type { Request, Response } from 'express'

import { isDevelopment } from '../constants/application'
import type { THttpResponse } from '../types/types'

export default (
  req: Request,
  res: Response,
  responseStatusCode: number,
  responseMessage: string,
  data: unknown = null
): void => {
  const response: THttpResponse = {
    success: true,
    statusCode: responseStatusCode,
    request: {
      ip: req.ip ?? null,
      method: req.method,
      url: req.originalUrl,
    },
    message: responseMessage,
    data,
  }

  // Production Env check
  if (!isDevelopment) {
    delete response.request.ip
  }

  res.status(responseStatusCode).json(response)
}
