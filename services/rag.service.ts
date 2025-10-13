import OpenAI from 'openai'

import config from '../config'
import type { RAGResponse } from '../types/types'
import logger from '../utils/logger'
import { EmbeddingService } from './embedding.service'
import { FileStorage } from './fileStorage.service'
import { VectorDatabaseService } from './vectorDatabase.service'

interface RAGRequest {
  message: string
  docIds: string[]
  systemPromptId?: string
  customSystemPrompt?: string
  retrievalConfig?: {
    maxChunks?: number
    minScore?: number
    documentFilters?: string[]
  }
}

export class RAGService {
  private openai: OpenAI
  private embeddingService: EmbeddingService
  private vectorService: VectorDatabaseService
  private storage: FileStorage
  private isInitialized = false

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    })
    this.embeddingService = new EmbeddingService()
    this.vectorService = new VectorDatabaseService()
    this.storage = new FileStorage()
  }

  /**
   * Initialize the RAG service
   */
  initialize(): void {
    try {
      this.vectorService.initialize()
      this.isInitialized = true
      logger.info('RAG service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize RAG service:', error)
      throw error
    }
  }

  /**
   * Generate a response using RAG
   */
  async generateResponse(request: RAGRequest): Promise<RAGResponse> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized')
    }

    const startTime = Date.now()

    try {
      // 1. Generate embedding for the user's question
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        request.message
      )

      // 2. Search for relevant chunks
      const maxChunks = request.retrievalConfig?.maxChunks || 5
      const minScore = request.retrievalConfig?.minScore || 0.7

      const relevantChunks = this.vectorService.searchSimilar(
        queryEmbedding,
        maxChunks,
        minScore
      )

      // Filter chunks by document IDs if specified
      const filteredChunks = relevantChunks.filter((result) =>
        request.docIds.includes(result.chunk?.documentId || '')
      )

      if (filteredChunks.length === 0) {
        // No relevant chunks found
        return {
          answer:
            "I couldn't find relevant information in the provided documents to answer your question. Could you please rephrase or provide more context?",
          referencedChunks: [],
        }
      }

      // 3. Get system prompt
      const systemPrompt = this.getSystemPrompt(
        request.systemPromptId,
        request.customSystemPrompt,
        filteredChunks[0]?.chunk?.metadata?.documentType as 'pdf' | 'text'
      )

      // 4. Construct the prompt with context
      const contextText = filteredChunks
        .map(
          (result, index) =>
            `[Context ${index + 1}] (from ${String(result.chunk?.metadata?.documentName) || 'unknown'}):\n${result.chunk?.content || ''}\n`
        )
        .join('\n')

      const prompt = `${systemPrompt}\n\nContext Information:\n${contextText}\n\nUser Question: ${request.message}\n\nResponse:`

      // 5. Generate response using OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        // eslint-disable-next-line camelcase
        max_tokens: 1500,
      })

      const answer =
        response.choices[0]?.message?.content ||
        'I apologize, but I was unable to generate a response.'
      const tokensUsed = response.usage?.total_tokens || 0
      const processingTime = Date.now() - startTime

      logger.info('RAG response generated', {
        chunksUsed: filteredChunks.length,
        tokensUsed,
        processingTime,
      })

      return {
        answer,
        referencedChunks: filteredChunks.map((result) => ({
          chunkId: result.chunkId,
          score: result.score,
          content: result.chunk?.content || '',
        })),
      }
    } catch (error) {
      logger.error('RAG response generation failed:', error)
      throw new Error(
        `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get system prompt for the conversation
   */
  private getSystemPrompt(
    systemPromptId?: string,
    customSystemPrompt?: string,
    documentType?: 'pdf' | 'text'
  ): string {
    // Use custom prompt if provided
    if (customSystemPrompt) {
      return customSystemPrompt
    }

    // Use specified system prompt
    if (systemPromptId) {
      const systemPrompt = this.storage.getSystemPromptById(systemPromptId)
      if (systemPrompt) {
        return systemPrompt.content
      }
    }

    // Find default prompt for document type
    if (documentType) {
      const defaultPrompt = this.storage.getDefaultSystemPrompt(documentType)
      if (defaultPrompt) {
        return defaultPrompt.content
      }
    }

    // Fallback to generic prompt
    return `You are a helpful assistant that answers questions based on the provided context. 
Use only the information from the context to answer the user's question. 
If the context doesn't contain enough information to answer the question, say so clearly.
Be concise and accurate in your responses.
When referencing information, mention which document it came from if relevant.`
  }

  /**
   * Batch process multiple queries (useful for testing or batch operations)
   */
  async batchGenerateResponses(requests: RAGRequest[]): Promise<RAGResponse[]> {
    const responses: RAGResponse[] = []

    for (const request of requests) {
      try {
        const response = await this.generateResponse(request)
        responses.push(response)
      } catch (error) {
        logger.error('Batch RAG processing failed for request:', error)
        // Continue with other requests
        responses.push({
          answer: 'Failed to process this request',
          referencedChunks: [],
        })
      }
    }

    return responses
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      vectorStats: this.vectorService.getStats(),
    }
  }
}
