import type { Request, Response } from 'express'

import { AuthError } from '../services/authError'
import { AuthService } from '../services/auth.service'
import type { LoginRequest, RegisterRequest } from '../types/types'
import httpResponse from '../utils/httpResponse'
import logger from '../utils/logger'

export class AuthController {
  private authService: AuthService

  constructor() {
    this.authService = new AuthService()
  }

  private setSessionCookie(res: Response, token: string) {
    res.cookie('document_access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })
  }

  /**
   * Register a new user
   */
  public register = async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } =
        req.body as RegisterRequest

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        httpResponse(req, res, 400, 'All fields are required')
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        httpResponse(req, res, 400, 'Invalid email format')
        return
      }

      // Validate password strength
      if (password.length < 8) {
        httpResponse(
          req,
          res,
          400,
          'Password must be at least 8 characters long'
        )
        return
      }

      const authResponse = await this.authService.register({
        email,
        password,
        firstName,
        lastName,
      })

      httpResponse(
        req,
        res,
        201,
        'Check your email for the verification code.',
        authResponse
      )
    } catch (error) {
      if (error instanceof AuthError) {
        res
          .status(error.status)
          .json({ success: false, message: error.message, code: error.code })
        return
      }
      logger.error('Registration error:', error)

      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          httpResponse(req, res, 409, error.message)
          return
        }
      }

      httpResponse(req, res, 500, 'Failed to register user')
    }
  }

  /**
   * Login user
   */
  public login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as LoginRequest

      // Validate required fields
      if (!email || !password) {
        httpResponse(req, res, 400, 'Email and password are required')
        return
      }

      const authResponse = await this.authService.login({ email, password })
      this.setSessionCookie(res, authResponse.token)
      httpResponse(req, res, 200, 'Login successful', authResponse)
    } catch (error) {
      if (error instanceof AuthError) {
        res
          .status(error.status)
          .json({ success: false, message: error.message, code: error.code })
        return
      }
      logger.error('Login error:', error)

      if (error instanceof Error) {
        if (error.message.includes('Invalid credentials')) {
          httpResponse(req, res, 400, error.message)
          return
        }
      }

      httpResponse(req, res, 500, 'Failed to login')
    }
  }

  /**
   * Logout user
   */
  public logout = async (req: Request, res: Response) => {
    try {
      if (!req.user?.token) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      await this.authService.logout(req.user.token)
      res.clearCookie('document_access_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV !== 'development', path: '/' })

      httpResponse(req, res, 200, 'Logout successful')
    } catch (error) {
      logger.error('Logout error:', error)
      httpResponse(req, res, 500, 'Failed to logout')
    }
  }

  /**
   * Get current user profile
   */
  public getProfile = (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      const user = this.authService.getUserById(req.user.id)

      if (!user) {
        httpResponse(req, res, 200, 'Profile retrieved successfully', {
          user: { id: req.user.id },
        })
        return
      }

      // Password is already removed by getUserById method
      httpResponse(req, res, 200, 'Profile retrieved successfully', {
        user,
      })
    } catch (error) {
      logger.error('Get profile error:', error)
      httpResponse(req, res, 500, 'Failed to retrieve profile')
    }
  }
}
