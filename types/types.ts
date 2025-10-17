export interface THttpResponse {
  success: boolean
  statusCode: number
  request: {
    ip?: string | null
    method: string
    url: string
  }
  message: string
  data: unknown
}

export interface THttpError {
  success: boolean
  statusCode: number
  request: {
    ip?: string | null
    method: string
    url: string
  }
  message: string
  data: unknown
  trace?: object | null
}

// User Management Types
export interface User {
  id: string
  email: string
  password: string // hashed
  firstName: string
  lastName: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
  lastLoginAt?: Date
}

export interface UserSession {
  id: string
  userId: string
  token: string
  expiresAt: Date
  createdAt: Date
  isActive: boolean
}

// Agent Management Types
export interface Agent {
  id: string
  userId: string
  name: string
  description?: string
  systemPrompt: string
  role?: string
  documentIds: string[] // Associated documents
  config?: {
    temperature?: number
    maxTokens?: number
    model?: string
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Enhanced Document Types
export interface Document {
  id: string
  userId: string // Owner of the document
  agentIds: string[] // Agents that can access this document
  name: string
  content: string
  type: 'pdf' | 'text'
  uploadedAt: Date
  updatedAt: Date
  size: number
  metadata?: Record<string, unknown>
}

export interface Chunk {
  id: string
  documentId: string
  content: string
  index: number
  embedding?: number[]
  vector?: number[]
  startPosition?: number
  endPosition?: number
  metadata?: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  referencedChunkIds?: string[]
}

export interface ChatSession {
  id: string
  userId: string
  agentId?: string // Selected agent for this chat (optional for sessions without default agent)
  title: string
  messages: ChatMessage[]
  documentIds: string[] // Documents associated with this chat session
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface SystemPrompt {
  id: string
  name: string
  type: string
  content: string
  prompt?: string
  documentTypes: string[]
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DocumentGroup {
  id: string
  userId: string
  name: string
  description?: string
  documentIds: string[]
  createdAt: Date
  updatedAt: Date
}

// Authentication Types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface AuthResponse {
  user: Omit<User, 'password'>
  token: string
  expiresAt: Date
}

export interface EmbeddingModel {
  name: string
  dimensions: number
  provider: 'openai' | 'huggingface' | 'google'
  maxTokens?: number
}

export interface VectorSearchResult {
  chunkId: string
  score: number
  chunk?: Chunk
}

export interface RAGResponse {
  answer: string
  referencedChunks: Array<{
    chunkId: string
    score: number
    content: string
  }>
}
