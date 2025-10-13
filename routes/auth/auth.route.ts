/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express'

import { AuthController } from '../../controllers/auth.controller'
import { authMiddleware } from '../../middlewares/auth.middleware'
import { validateBody } from '../../middlewares/validation.middleware'
import { loginSchema, registerSchema } from '../../schemas/auth.schema'

const router = Router()
const authController = new AuthController()

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
router.post('/logout', authController.logout.bind(authController))

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
