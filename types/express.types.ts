import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
  RequestHandler,
} from 'express'

// Extend Express Request to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string
        email?: string
        name?: string
        sessionId?: string
        token?: string
      }
    }
  }
}

export type ECoreReq = ExpressRequest

export type ERes = ExpressResponse

export type ENext = NextFunction

export type ENextHandler = RequestHandler
