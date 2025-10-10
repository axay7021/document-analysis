import type { Request } from 'express'

import { isDevelopment } from '../constants/application'
import responseMessage from '../constants/responseMessage'
import type { THttpError } from '../types/types'
import logger from './logger'

export default (
  err: unknown,
  req: Request,
  errorStatusCode = 500
): THttpError => {
  const errorObj: THttpError = {
    success: false,
    statusCode: errorStatusCode,
    request: {
      ip: req.ip ?? null,
      method: req.method,
      url: req.originalUrl,
    },
    message:
      err instanceof Error
        ? err.message || responseMessage.SOMETHING_WENT_WRONG
        : responseMessage.SOMETHING_WENT_WRONG,
    data: null,
    trace: err instanceof Error ? { error: err.stack } : null,
  }

  // Log
  logger.error(`CONTROLLER_ERROR`, {
    meta: errorObj,
  })

  // Production Env check
  if (!isDevelopment) {
    delete errorObj.request.ip
    delete errorObj.trace
  }

  return errorObj
}
