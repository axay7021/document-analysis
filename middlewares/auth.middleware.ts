import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { config } from '../config'
import { UserSessionModel } from '../models'
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      httpResponse(req, res, 401, 'Access denied. No valid token provided.')
      return
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify JWT token
    const jwtSecret =
      config.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload

    // Check if session exists and is valid
    const session = UserSessionModel.findByToken(token)

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      httpResponse(req, res, 401, 'Invalid or expired token.')
      return
    }

    // Add user info to request
    req.user = {
      id: decoded.userId,
      sessionId: decoded.sessionId,
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
    const jwtSecret =
      config.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'

    try {
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload
      const session = UserSessionModel.findByToken(token)

      if (session && session.isActive && session.expiresAt > new Date()) {
        req.user = {
          id: decoded.userId,
          sessionId: decoded.sessionId,
          token,
        }
      }
    } catch (error) {
      // Invalid token, but continue without user
    }

    next()
  } catch (error) {
    next()
  }
}
