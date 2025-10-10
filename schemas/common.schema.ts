import { Joi } from 'express-validation'

import { REGEX } from '../constants/json'
import responseMessage from '../constants/responseMessage'

export const passwordValidation = Joi.string().min(4).max(16).required()

export const emailValidation = Joi.string().email().required()

export const ObjectID = Joi.string()
  .pattern(REGEX.MONGO_OBJECT_ID)
  .trim()
  .strict(true)
  .required()
  .messages({ 'string.pattern.base': responseMessage.PROVIDE_VALID_OBJECT_ID })

export const paramsValidation = Joi.object({
  id: ObjectID,
})

export const tokenValidation = Joi.object({
  token: Joi.string(),
})

export const signup = {
  body: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    username: Joi.string(),
    email: emailValidation,
    password: passwordValidation,
    avatar: Joi.string().required(),
    role: ObjectID,
    mobile: Joi.string().required(),
    countryCode: Joi.string().required(),
    countryIsoCode: Joi.string().required(),
  }),
}

export const login = {
  body: Joi.object({
    email: emailValidation,
    password: passwordValidation,
  }),
}

export const forgotPassword = {
  body: Joi.object({
    email: emailValidation,
  }),
}

export const resetPassword = {
  body: Joi.object({
    password: passwordValidation,
  }),
}

export const resendVerificationLink = {
  body: Joi.object({
    email: emailValidation,
  }),
}

export const updateProfile = {
  body: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    mobile: Joi.string().required(),
    avatar: Joi.string(),
    countryCode: Joi.string().required(),
    countryIsoCode: Joi.string().required(),
  }),
  params: paramsValidation,
}

export const changePassword = {
  body: Joi.object({
    currentPassword: passwordValidation,
    newPassword: passwordValidation
      .invalid(Joi.ref('currentPassword'))
      .messages({
        'any.invalid': responseMessage.SAME_PASSWORD,
      }),
  }),
}

export const getAllResults = {
  body: Joi.object({
    search: Joi.string().allow(''),
    fields: Joi.string().allow(''),
    sort: Joi.number().valid(-1, 1).allow(''),
    sortBy: Joi.string().allow(''),
    dateField: Joi.string().allow(''),
    startDate: Joi.string().allow(''),
    endDate: Joi.string().allow(''),
    pagination: Joi.boolean().strict(true),
    isActive: Joi.boolean().strict(true),
  }),
  query: Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
  }),
}

export const updateStatus = {
  body: Joi.object({
    status: Joi.boolean().strict(true).required(),
  }),
  params: paramsValidation,
}
