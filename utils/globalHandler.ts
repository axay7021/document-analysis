/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */

import type { NextFunction, Request, Response } from 'express'

import httpError from './httpError'

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>
type SyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void

export const asyncHandler =
  (fn: AsyncRequestHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      httpError(next, err, req)
    })
  }

export const syncHandler =
  (fn: SyncRequestHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      fn(req, res, next)
    } catch (err) {
      httpError(next, err, req)
    }
  }

export interface AuthenticatedRequest extends Request {
  userId: string
}

type HandlerFunction = (
  req: Request | AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | void

const globalHandler =
  (fn: HandlerFunction) =>
  (
    req: Request | AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      httpError(next, error, req)
    })
  }

export default globalHandler
