import Joi from 'joi'

import responseMessage from '../constants/responseMessage'
import { createSchema } from '../helpers/schema.helper'
import { CompanySize } from '../models/company/company.types'

export const createCompanySchema = createSchema(
  Joi.object({
    name: Joi.string()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'name'
        ),
      }),

    industry: Joi.string()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'industry'
        ),
      }),

    location: Joi.string()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'location'
        ),
      }),

    size: Joi.string()
      .valid(...Object.values(CompanySize))
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'size'
        ),
        'any.only':
          'Size must be one of: ' + Object.values(CompanySize).join(', '),
      }),

    status: Joi.string()
      .valid('active', 'inactive')
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'status'
        ),
        'any.only': 'Status must be either "active" or "inactive"',
      }),
  })
)
