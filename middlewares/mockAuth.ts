import type { NextFunction, Request, Response } from 'express'

// Import to ensure types are loaded
import '../types/express.types'

// Mock user for testing purposes (remove in production)
export const mockAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Add a mock user to the request for testing
  req.user = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  }

  next()
}
