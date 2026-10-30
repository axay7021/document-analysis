import { aiConfigured } from '../../services/aiProvider'
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { AuthError } from '../../services/authError'
import { AuthService } from '../../services/auth.service'
import { GoogleAuthService } from '../../services/googleAuth.service'
import { verificationMailer } from '../../services/verificationMailer'

import { AuthController } from '../../controllers/auth.controller'
import { authMiddleware } from '../../middlewares/auth.middleware'
import { validateBody } from '../../middlewares/validation.middleware'
import { loginSchema, registerSchema } from '../../schemas/auth.schema'

const router = Router()
const authController = new AuthController()
const service = new AuthService()
const google = new GoogleAuthService()
const attempts = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many attempts. Try again in 15 minutes.',
  },
})
const verificationAttempts = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many verification attempts. Try again in 15 minutes.',
  },
})
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})
router.use(attempts)
const email = Joi.string().email().max(254).required()
function failure(res: Response, error: unknown) {
  if (error instanceof AuthError)
    res
      .status(error.status)
      .json({ success: false, message: error.message, code: error.code })
  else
    res.status(500).json({
      success: false,
      message: 'Unable to complete sign-in. Please try again.',
      code: 'AUTH_FAILED',
    })
}
router.get('/config', (_req, res) =>
  res.json({
    emailVerificationRequired: true,
    aiConfigured: aiConfigured(),
    emailConfigured: verificationMailer.configured(),
    googleConfigured: google.configured(),
  })
)
router.post(
  '/verify-email',
  verificationAttempts,
  validateBody(
    Joi.object({
      email,
      code: Joi.string()
        .pattern(/^\d{6}$/)
        .required(),
    }).unknown(false)
  ),
  async (req: Request, res: Response) => {
    try {
      const data = await service.verifyEmail(req.body.email, req.body.code)
      res.cookie('document_access_token', data.token, {
        httpOnly: true, secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/',
      })
      res.json({ success: true, data, message: 'Email verified.' })
    } catch (error) {
      failure(res, error)
    }
  }
)
router.post(
  '/resend-verification',
  verificationAttempts,
  validateBody(Joi.object({ email }).unknown(false)),
  async (req: Request, res: Response) => {
    try {
      await service.resendVerification(req.body.email)
      res.json({
        success: true,
        message:
          'If this account needs verification, a code has been sent. Please wait a minute before trying again.',
      })
    } catch (error) {
      failure(res, error)
    }
  }
)
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'lax' as const,
  path: '/api/v1/auth/google',
}
router.get('/google', async (req: Request, res: Response) => {
  try {
    const flow = await google.begin(String(req.query.challenge || ''))
    res.cookie('document_google_flow', flow.cookie, {
      ...cookieOptions,
      maxAge: 600000,
    })
    res.redirect(flow.url)
  } catch (error) {
    failure(res, error)
  }
})
router.get('/google/callback', async (req: Request, res: Response) => {
  res.clearCookie('document_google_flow', cookieOptions)
  try {
    if (req.query.error)
      throw new AuthError('GOOGLE_CANCELLED', 'Google sign-in was cancelled.')
    const redirect = await google.callback(
      String(req.cookies?.document_google_flow || ''),
      String(req.query.state || ''),
      String(req.query.code || '')
    )
    res.redirect(redirect)
  } catch (error) {
    res.redirect(
      google.errorRedirect(
        error instanceof AuthError ? error.code : 'GOOGLE_FAILED'
      )
    )
  }
})
router.post(
  '/google/exchange',
  validateBody(
    Joi.object({
      code: Joi.string().max(100).required(),
      verifier: Joi.string().max(100).required(),
    }).unknown(false)
  ),
  (req: Request, res: Response) => {
    try {
      const data = google.exchange(
        req.body.code,
        req.body.verifier,
        req.get('origin') || ''
      )
      res.cookie('document_access_token', data.token, {
        httpOnly: true, secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/',
      })
      res.json({
        success: true,
        data,
      })
    } catch (error) {
      failure(res, error)
    }
  }
)

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 */
router.post(
  '/register',
  validateBody(registerSchema),
  authController.register.bind(authController)
)

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 */
router.post(
  '/login',
  validateBody(loginSchema),
  authController.login.bind(authController)
)

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user (requires authentication)
 */
router.post(
  '/logout',
  authMiddleware,
  authController.logout.bind(authController)
)

/**
 * @route GET /api/v1/auth/profile
 * @desc Get user profile (requires authentication)
 */
router.get(
  '/profile',
  authMiddleware,
  authController.getProfile.bind(authController)
)

export default router
