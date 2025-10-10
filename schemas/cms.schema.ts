// import Joi from 'joi'

// import { createSchema } from './schemaHelper'
// import responseMessage from '../constant/responseMessage'

// const propertyIdSchema = Joi.array()
//     .items(Joi.string())
//     .required()
//     .messages({
//         'any.required': responseMessage.validation.required.replace('{#label}', 'propertyIds')
//     })

// export const createCMSModelSchema = createSchema(
//     Joi.object({
//         name: Joi.string()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'name')
//             }),

//         type: Joi.string()
//             .valid('post', 'user', 'custom')
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', '役割')
//             })
//     })
// )

// export const createCMSModelDataSchema = createSchema(
//     Joi.object({
//         slug: Joi.string()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'slug')
//             })
//     })
// )

// export const addCMSModelPropertySchema = createSchema(
//     Joi.object({
//         name: Joi.string()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'name')
//             }),

//         type: Joi.string()
//             .valid('text', 'textarea', 'number', 'boolean', 'color', 'image', 'date', 'category')
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'type')
//             }),

//         selectOption: Joi.string().valid('single', 'multiple').when('type', { is: 'category', then: Joi.required() }),
//         categoryId: Joi.string().when('type', { is: 'category', then: Joi.required() })
//     })
// )

// export const createCMSCategorySchema = createSchema(
//     Joi.object({
//         name: Joi.string()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'name')
//             })
//     })
// )

// export const createCMSCollectionSchema = createSchema(
//     Joi.object({
//         name: Joi.string()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'name')
//             }),

//         modelId: Joi.string()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'メンバーID')
//             })
//     })
// )

// export const addDataToCollectionSchema = createSchema(
//     Joi.object({
//         cmsModelDataId: Joi.string()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'メンバーID')
//             })
//     })
// )

// export const updateCMSOrderSchema = createSchema(
//     Joi.object({
//         propertyIds: propertyIdSchema
//     })
// )

// export const updateCMSPropertyOrderSchema = createSchema(
//     Joi.object({
//         propertyIds: propertyIdSchema
//     })
// )

// export const updateCMSPropertyNameSchema = createSchema(
//     Joi.object({
//         name: Joi.string()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'name')
//             })
//     })
// )

// export const updateCMSPropertyVisibilitySchema = createSchema(
//     Joi.object({
//         visibility: Joi.boolean()
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'visibility')
//             })
//     })
// )

// export const updateCMSCategoryStatusSchema = createSchema(
//     Joi.object({
//         propertyIds: propertyIdSchema,
//         status: Joi.string()
//             .valid('PUBLISHED', 'TRASH')
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'type')
//             })
//     })
// )

// export const updateCMSModelStatusSchema = createSchema(
//     Joi.object({
//         propertyIds: propertyIdSchema,
//         status: Joi.string()
//             .valid('PUBLISHED', 'DRAFT', 'TRASH')
//             .required()
//             .messages({
//                 'any.required': responseMessage.validation.required.replace('{#label}', 'type')
//             })
//     })
// )

// export const updateContentPropertyOrderSchema = createSchema(
//     Joi.object({
//         properties: Joi.array()
//             .items(
//                 Joi.object({
//                     id: Joi.string().required(),
//                     order: Joi.number().required()
//                 })
//             )
//             .required()
//     })
// )
