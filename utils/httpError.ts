import type { NextFunction, Request } from 'express'

import errorObject from './errorObject'

export default (
  nextFunc: NextFunction,
  err: unknown,
  req: Request,
  errorStatusCode = 500
): void => {
  const errorObj = errorObject(err, req, errorStatusCode)
  nextFunc(errorObj)
}
