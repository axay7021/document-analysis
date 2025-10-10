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

// Document Analysis Types
export interface Document {
  id: string
  name: string
  content: string
  type: 'pdf' | 'text'
  uploadedAt: Date
  size: number
  groupId?: string
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
  title: string
  documentIds: string[]
  messages: ChatMessage[]
  systemPrompt?: string
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
  name: string
  description?: string
  documentIds: string[]
  createdAt: Date
  updatedAt: Date
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
