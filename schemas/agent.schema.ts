import Joi from 'joi'

// Agent role types
export const AgentRole = {
  ASSISTANT: 'assistant',
  ANALYST: 'analyst',
  RESEARCHER: 'researcher',
  WRITER: 'writer',
  CUSTOM: 'custom',
} as const

export type AgentRoleType = (typeof AgentRole)[keyof typeof AgentRole]

// Agent configuration schema
export const agentConfigSchema = Joi.object({
  temperature: Joi.number().min(0).max(2).default(0.7),
  maxTokens: Joi.number().integer().min(1).max(4096).default(1000),
  model: Joi.string()
    .valid('gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo')
    .default('gpt-3.5-turbo'),
  enableRAG: Joi.boolean().default(true),
  maxDocuments: Joi.number().integer().min(0).max(50).default(10),
}).unknown(false)

// Create agent request validation (for form data with file uploads)
export const createAgentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Agent name is required',
    'string.min': 'Agent name must be at least 1 character',
    'string.max': 'Agent name must not exceed 100 characters',
  }),
  description: Joi.string().trim().max(500).optional().messages({
    'string.max': 'Description must not exceed 500 characters',
  }),
  systemPrompt: Joi.string().trim().min(10).max(5000).required().messages({
    'string.empty': 'System prompt is required',
    'string.min': 'System prompt must be at least 10 characters',
    'string.max': 'System prompt must not exceed 5000 characters',
  }),
  role: Joi.string()
    .valid(...Object.values(AgentRole))
    .required()
    .messages({
      'any.only':
        'Role must be one of: assistant, analyst, researcher, writer, custom',
      'any.required': 'Role is required',
    }),
  config: Joi.string().optional(), // JSON string when using multipart/form-data
}).unknown(true) // Allow files and other multipart fields

// Update agent request validation
export const updateAgentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional().messages({
    'string.min': 'Agent name must be at least 1 character',
    'string.max': 'Agent name must not exceed 100 characters',
  }),
  description: Joi.string().trim().max(500).optional().messages({
    'string.max': 'Description must not exceed 500 characters',
  }),
  systemPrompt: Joi.string().trim().min(10).max(5000).optional().messages({
    'string.min': 'System prompt must be at least 10 characters',
    'string.max': 'System prompt must not exceed 5000 characters',
  }),
  role: Joi.string()
    .valid(...Object.values(AgentRole))
    .optional()
    .messages({
      'any.only':
        'Role must be one of: assistant, analyst, researcher, writer, custom',
    }),
  documentIds: Joi.alternatives()
    .try(
      Joi.string().uuid({ version: 'uuidv4' }), // Single document ID
      Joi.array().items(Joi.string().uuid({ version: 'uuidv4' })) // Array of document IDs
    )
    .optional()
    .messages({
      'alternatives.types':
        'Document IDs must be a single UUID string or array of UUID strings',
      'string.guid': 'Each document ID must be a valid UUID',
    }),
  config: Joi.string().optional(), // JSON string when using multipart/form-data
})
  .min(1)
  .unknown(true) // Allow files and other multipart fields
  .messages({
    'object.min': 'At least one field must be provided for update',
  })

// Agent ID parameter validation
export const agentIdSchema = Joi.object({
  agentId: Joi.string().required().messages({
    'string.empty': 'Agent ID is required',
    'any.required': 'Agent ID is required',
  }),
}).unknown(false)

// Agents query validation
export const agentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(10),
  search: Joi.string().trim().optional(),
  sortBy: Joi.string()
    .valid('name', 'createdAt', 'updatedAt', 'role')
    .optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc'),
}).unknown(false)

// Document association validation
export const associateDocumentSchema = Joi.object({
  documentId: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': 'Invalid document ID format',
    'any.required': 'Document ID is required',
  }),
}).unknown(false)

// Document removal validation
export const removeDocumentSchema = Joi.object({
  agentId: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': 'Invalid agent ID format',
    'any.required': 'Agent ID is required',
  }),
  documentId: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': 'Invalid document ID format',
    'any.required': 'Document ID is required',
  }),
}).unknown(false)

// TypeScript interfaces derived from Joi schemas
export interface CreateAgentRequest {
  name: string
  description?: string
  systemPrompt: string
  role: AgentRoleType
  config?: {
    temperature?: number
    maxTokens?: number
    model?: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo'
    enableRAG?: boolean
    maxDocuments?: number
  }
}

export interface CreateAgentWithFilesRequest extends CreateAgentRequest {
  files?: Express.Multer.File[]
}

export interface UpdateAgentRequest {
  name?: string
  description?: string
  systemPrompt?: string
  role?: AgentRoleType
  documentIds?: string[]
  config?: {
    temperature?: number
    maxTokens?: number
    model?: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo'
    enableRAG?: boolean
    maxDocuments?: number
  }
}

export interface AgentIdParams extends Record<string, string> {
  agentId: string
}

export interface AssociateDocumentRequest {
  documentId: string
}

export interface RemoveDocumentParams extends Record<string, string> {
  agentId: string
  documentId: string
}
