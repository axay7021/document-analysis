import Joi from 'joi'

import responseMessage from '../constants/responseMessage'
import { createSchema } from '../helpers/schema.helper'
import {
  ExperienceLevel,
  JobLocationRequirements,
  JobStatus,
} from '../models/job/job.types'

export const createJobSchema = createSchema(
  Joi.object({
    title: Joi.string()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'name'
        ),
      }),

    company: Joi.string()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'company'
        ),
      }),

    type: Joi.string()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'type'
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

    locationRequirements: Joi.string()
      .valid(...Object.values(JobLocationRequirements))
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'locationRequirements'
        ),
      }),

    minSalary: Joi.number()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'minSalary'
        ),
      }),

    maxSalary: Joi.number()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'maxSalary'
        ),
      }),

    description: Joi.string()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'description'
        ),
      }),

    experience: Joi.string()
      .valid(...Object.values(ExperienceLevel))
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'experience'
        ),
      }),

    education: Joi.string()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'education'
        ),
      }),

    postedDate: Joi.date()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'postedDate'
        ),
      }),

    deadline: Joi.date()
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'deadline'
        ),
      }),

    status: Joi.string()
      .valid(...Object.values(JobStatus))
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'status'
        ),
      }),

    requirements: Joi.array()
      .items(Joi.string())
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'requirements'
        ),
      }),

    responsibilities: Joi.array()
      .items(Joi.string())
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'responsibilities'
        ),
      }),

    benefits: Joi.array()
      .items(Joi.string())
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'benefits'
        ),
      }),

    skills: Joi.array()
      .items(Joi.string())
      .required()
      .messages({
        'any.required': responseMessage.validation.required.replace(
          '{#label}',
          'skills'
        ),
      }),
  })
)
