import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { config } from '../config'
import httpResponse from '../utils/httpResponse'
// Import to ensure types are loaded
import '../types/express.types'

export interface JWTPayload {
  userId: string
  sessionId: string
  iat: number
  exp: number
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.document_access_token
    if (!token) {
      httpResponse(req, res, 401, 'Access denied. No valid token provided.')
      return
    }

    // Verify JWT token
    const jwtSecret = config.JWT_SECRET

    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'ai-chat-platform',
      audience: 'document-analysis',
    }) as JWTPayload

    // Add user info to request
    req.user = {
      id: decoded.userId,
      sessionId: decoded.sessionId || decoded.userId,
      token,
    }

    next()
  } catch (error) {
    console.log(error)

    httpResponse(req, res, 401, 'Invalid token.')
    return
  }
}

// Optional middleware - doesn't fail if no token, but adds user if valid token
export const optionalAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next()
      return
    }

    const token = authHeader.substring(7)
    const jwtSecret = config.JWT_SECRET

    try {
      const decoded = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'ai-chat-platform',
        audience: 'document-analysis',
      }) as JWTPayload
      req.user = { id: decoded.userId, sessionId: decoded.sessionId || decoded.userId, token }
    } catch (error) {
      // Invalid token, but continue without user
    }

    next()
  } catch (error) {
    next()
  }
}
