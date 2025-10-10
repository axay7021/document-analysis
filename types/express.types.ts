import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
  RequestHandler,
} from 'express'

export type ECoreReq = ExpressRequest

export type ERes = ExpressResponse

export type ENext = NextFunction

export type ENextHandler = RequestHandler
