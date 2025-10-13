import Joi from 'joi'

// Email validation pattern
const emailValidation = Joi.string().email().required().messages({
  'string.email': 'Please enter a valid email address',
  'string.empty': 'Email is required',
  'any.required': 'Email is required',
})

// Password validation pattern
const passwordValidation = Joi.string().min(8).max(100).required().messages({
  'string.min': 'Password must be at least 8 characters long',
  'string.max': 'Password must not exceed 100 characters',
  'string.empty': 'Password is required',
  'any.required': 'Password is required',
})

// User registration validation
export const registerSchema = Joi.object({
  email: emailValidation,
  password: passwordValidation,
  firstName: Joi.string().trim().min(1).max(50).required().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name must not exceed 50 characters',
    'string.empty': 'First name is required',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().trim().min(1).max(50).required().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name must not exceed 50 characters',
    'string.empty': 'Last name is required',
    'any.required': 'Last name is required',
  }),
}).unknown(false)

// User login validation
export const loginSchema = Joi.object({
  email: emailValidation,
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
}).unknown(false)

// Password change validation
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required',
    'any.required': 'Current password is required',
  }),
  newPassword: passwordValidation,
}).unknown(false)

// Forgot password validation
export const forgotPasswordSchema = Joi.object({
  email: emailValidation,
}).unknown(false)

// Reset password validation
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Reset token is required',
    'any.required': 'Reset token is required',
  }),
  newPassword: passwordValidation,
}).unknown(false)

// Profile update validation
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(50).optional().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name must not exceed 50 characters',
  }),
  lastName: Joi.string().trim().min(1).max(50).optional().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name must not exceed 50 characters',
  }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Please enter a valid email address',
  }),
}).unknown(false)
