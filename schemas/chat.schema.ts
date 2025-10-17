import Joi from 'joi'

// Create chat session validation
export const createChatSessionSchema = Joi.object({
  agentId: Joi.string().trim().optional().messages({
    'string.empty': 'Agent ID cannot be empty',
  }),
  title: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Title must not exceed 200 characters',
  }),
}).unknown(false)

// Send message validation
export const sendMessageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(5000).required().messages({
    'string.empty': 'Message cannot be empty',
    'string.min': 'Message cannot be empty',
    'string.max': 'Message must not exceed 5000 characters',
    'any.required': 'Message is required',
  }),
  promptId: Joi.string()
    .uuid({ version: 'uuidv4' })
    .allow('', null)
    .optional()
    .messages({
      'string.guid': 'Prompt ID must be a valid UUID',
    }),
}).unknown(false)

// Update chat session title validation
export const updateChatSessionTitleSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Title cannot be empty',
    'string.min': 'Title cannot be empty',
    'string.max': 'Title must not exceed 200 characters',
    'any.required': 'Title is required',
  }),
}).unknown(false)

// Session ID parameter validation
export const sessionIdParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required',
  }),
}).unknown(false)

// Agent ID parameter validation
export const agentIdParamsSchema = Joi.object({
  agentId: Joi.string().trim().required().messages({
    'string.empty': 'Agent ID is required',
    'any.required': 'Agent ID is required',
  }),
}).unknown(false)

// Chat sessions query validation
export const chatSessionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(10),
  search: Joi.string().trim().optional(),
  agentId: Joi.string().trim().optional(),
}).unknown(false)
