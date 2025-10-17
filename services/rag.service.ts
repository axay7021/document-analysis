import OpenAI from 'openai'

import config from '../config'
import type { RAGResponse } from '../types/types'
import logger from '../utils/logger'
import { EmbeddingService } from './embedding.service'
import { FileStorage } from './fileStorage.service'
import { VectorDatabaseService } from './vectorDatabase.enhanced.service'

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
    this.vectorService = VectorDatabaseService.getGlobalInstance()
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
      this.initialize()
    }

    // Ensure vector database is loaded
    const vectorStats = this.vectorService.getStats()
    if (vectorStats.totalVectors === 0) {
      logger.info('Vector database empty, reinitializing...')
      this.vectorService.initialize()
    }

    const startTime = Date.now()

    try {
      // Validate request message
      if (
        !request.message ||
        typeof request.message !== 'string' ||
        request.message.trim() === ''
      ) {
        throw new Error('Invalid or empty message provided')
      }

      // 1. Generate embedding for the user's question
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        request.message.trim()
      )

      // 2. Search for relevant chunks
      const maxChunks = request.retrievalConfig?.maxChunks || 5
      const minScore = request.retrievalConfig?.minScore || -1.0

      const relevantChunks = this.vectorService.searchSimilar(
        queryEmbedding,
        maxChunks,
        minScore
      )

      // Filter chunks by document IDs if specified, or use all chunks if no docIds provided
      const filteredChunks =
        request.docIds.length > 0
          ? relevantChunks.filter((result) =>
              request.docIds.includes(result.chunk?.documentId || '')
            )
          : relevantChunks // Use all relevant chunks if no specific documents requested

      if (filteredChunks.length === 0) {
        // No relevant chunks found - generate basic AI response
        if (request.docIds.length > 0) {
          // Check if we have relevant chunks but from wrong documents (vector DB issue)
          if (relevantChunks.length > 0) {
            logger.warn(
              'Non-streaming: Vector database document ID mismatch - using available chunks'
            )
            // Use the best available chunks even if document IDs don't match
            const bestChunks = relevantChunks.slice(0, 3)

            const systemPrompt = this.getSystemPrompt(
              request.systemPromptId,
              request.customSystemPrompt,
              'text'
            )

            const contextText = bestChunks
              .map(
                (result, index) =>
                  `[Context ${index + 1}] (from document):\n${(
                    result.chunk?.content || ''
                  ).substring(0, 200)}\n`
              )
              .join('\n')

            const prompt = `${systemPrompt}\n\nContext Information:\n${contextText}\n\nUser Question: ${request.message}\n\nResponse:`

            const response = await this.openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
            })

            const answer =
              response.choices[0]?.message?.content ||
              'I apologize, but I was unable to generate a response.'

            return {
              answer,
              referencedChunks: bestChunks.map((result) => ({
                chunkId: result.chunkId,
                score: result.score,
                content: result.chunk?.content || '',
              })),
            }
          }

          // User requested specific documents but none found
          const fallbackAnswer =
            "I couldn't find relevant information in the provided documents to answer your question. Could you please rephrase or provide more context?"
          return {
            answer: fallbackAnswer,
            referencedChunks: [],
          }
        } else {
          // No documents requested - generate general AI response
          const basicSystemPrompt =
            "You are a helpful AI assistant. Respond naturally and helpfully to the user's message."

          try {
            const response = await this.openai.chat.completions.create({
              model: 'gpt-4.1',
              messages: [
                {
                  role: 'system',
                  content: basicSystemPrompt,
                },
                {
                  role: 'user',
                  content: request.message,
                },
              ],
              temperature: 0.1,
            })

            const answer =
              response.choices[0]?.message?.content ||
              'I apologize, but I was unable to generate a response.'

            return {
              answer,
              referencedChunks: [],
            }
          } catch (error) {
            logger.error('Failed to generate basic AI response:', error)
            return {
              answer: "I'm here to help! Could you please ask me a question?",
              referencedChunks: [],
            }
          }
        }
      }

      // 3. Get system prompt
      const systemPrompt = this.getSystemPrompt(
        request.systemPromptId,
        request.customSystemPrompt,
        filteredChunks[0]?.chunk?.metadata?.documentType as 'pdf' | 'text'
      )

      // 4. Construct the prompt with context (truncate content to manage token limits)
      const contextText = filteredChunks
        .map(
          (result, index) =>
            `[Context ${index + 1}] (from ${String(result.chunk?.metadata?.documentName) || 'unknown'}):\n${(result.chunk?.content || '').substring(0, 200)}\n`
        )
        .join('\n')

      const prompt = `${systemPrompt}\n\nContext Information:\n${contextText}\n\nUser Question: ${request.message}\n\nResponse:`

      // 5. Generate response using OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
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
   * Generate streaming response using RAG with real-time chunks
   */
  async generateStreamingResponse(
    request: RAGRequest,
    onChunk: (chunk: {
      type: 'chunk' | 'message' | 'error'
      content: string
      sources?: Array<{
        documentId: string
        documentName: string
        chunkId: string
        relevanceScore: number
      }>
    }) => void
  ): Promise<RAGResponse> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized')
    }

    const startTime = Date.now()

    try {
      // Validate request message
      if (
        !request.message ||
        typeof request.message !== 'string' ||
        request.message.trim() === ''
      ) {
        throw new Error('Invalid or empty message provided')
      }

      // 1. Generate embedding for the user's question
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        request.message.trim()
      )
      // cec1e6f7-2702-4c96-acf8-82c3a8b77618
      console.log(queryEmbedding, 'queryEmbedding')

      // 2. Search for relevant chunks
      const maxChunks = request.retrievalConfig?.maxChunks || 5
      const minScore = request.retrievalConfig?.minScore || -1.0

      // Check vector service state
      const vectorStats = this.vectorService.getStats()

      // Force re-initialize if no vectors
      if (vectorStats.totalVectors === 0) {
        this.vectorService.initialize()
      }

      const relevantChunks = this.vectorService.searchSimilar(
        queryEmbedding,
        maxChunks,
        minScore
      )
      console.log(relevantChunks, 'relevantChunk')

      logger.info('Relevant chunks found', { count: relevantChunks.length })

      // Debug: Log document IDs for filtering
      logger.info('Expected document IDs:', { docIds: request.docIds })
      logger.info(
        'Found chunk document IDs:',
        relevantChunks.map((r) => ({
          chunkId: r.chunkId,
          documentId: r.chunk?.documentId,
          content: (r.chunk?.content || '').substring(0, 100) + '...',
        }))
      )

      // Filter chunks by document IDs if specified, or use all chunks if no docIds provided
      const filteredChunks =
        request.docIds.length > 0
          ? relevantChunks.filter((result) => {
              const isMatch = request.docIds.includes(
                result.chunk?.documentId || ''
              )
              logger.info(
                `Chunk ${result.chunkId} (docId: ${
                  result.chunk?.documentId
                }) matches expected docIds: ${isMatch}`
              )
              return isMatch
            })
          : relevantChunks // Use all relevant chunks if no specific documents requested

      logger.info('Filtered chunks count:', { count: filteredChunks.length })

      if (filteredChunks.length === 0) {
        // No relevant chunks found
        if (request.docIds.length > 0) {
          // User requested specific documents but none found
          logger.warn('No chunks found for specified documents', {
            requestedDocIds: request.docIds,
            foundChunks: relevantChunks.length,
            foundDocIds: relevantChunks
              .map((r) => r.chunk?.documentId)
              .filter(Boolean),
          })

          // Check if we have relevant chunks but from wrong documents
          if (relevantChunks.length > 0) {
            logger.warn(
              'Vector database may have document ID mismatch - using available chunks anyway'
            )
            // Use the best available chunks even if document IDs don't match
            const bestChunks = relevantChunks.slice(0, 3) // Use top 3 chunks

            // Continue with processing using available chunks
            const systemPrompt = this.getSystemPrompt(
              request.systemPromptId,
              request.customSystemPrompt,
              'text'
            )

            const contextText = bestChunks
              .map(
                (result, index) =>
                  `[Context ${index + 1}]:\n${(
                    result.chunk?.content || ''
                  ).substring(0, 300)}\n`
              )
              .join('\n')

            const prompt = `${systemPrompt}\n\nContext Information:\n${contextText}\n\nUser Question: ${request.message}\n\nResponse:`

            const response = await this.openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
            })

            const answer =
              response.choices[0]?.message?.content ||
              'I apologize, but I was unable to generate a response.'

            onChunk({
              type: 'message',
              content: answer,
              sources: [],
            })

            return {
              answer,
              referencedChunks: bestChunks.map((result) => ({
                chunkId: result.chunkId,
                score: result.score,
                content: result.chunk?.content || '',
              })),
            }
          }

          const fallbackAnswer =
            "I couldn't find relevant information in the provided documents to answer your question. Could you please rephrase or provide more context?"

          onChunk({
            type: 'message',
            content: fallbackAnswer,
            sources: [],
          })

          return {
            answer: fallbackAnswer,
            referencedChunks: [],
          }
        } else {
          // No documents requested - generate general AI response with streaming
          const basicSystemPrompt =
            "You are a helpful AI assistant. Respond naturally and helpfully to the user's message."

          try {
            const stream = await this.openai.chat.completions.create({
              model: 'gpt-4.1',
              messages: [
                {
                  role: 'system',
                  content: basicSystemPrompt,
                },
                {
                  role: 'user',
                  content: request.message,
                },
              ],
              temperature: 0.1,
              stream: true,
            })

            let fullAnswer = ''
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || ''
              if (content) {
                fullAnswer += content

                // Send content as received from OpenAI for true streaming
                onChunk({
                  type: 'message',
                  content,
                  sources: [],
                })
              }
            }

            return {
              answer:
                fullAnswer ||
                'I apologize, but I was unable to generate a response.',
              referencedChunks: [],
            }
          } catch (error) {
            logger.error(
              'Failed to generate basic AI streaming response:',
              error
            )
            const fallbackAnswer =
              "I'm here to help! Could you please ask me a question?"

            onChunk({
              type: 'message',
              content: fallbackAnswer,
              sources: [],
            })

            return {
              answer: fallbackAnswer,
              referencedChunks: [],
            }
          }
        }
      }

      // 3. Get system prompt
      const systemPrompt = this.getSystemPrompt(
        request.systemPromptId,
        request.customSystemPrompt,
        filteredChunks[0]?.chunk?.metadata?.documentType as 'pdf' | 'text'
      )

      // 4. Construct the prompt with context (truncated to fit token limits)
      const maxChunkLength = 500 // Limit each chunk to 500 characters
      const contextText = filteredChunks
        .map((result, index) => {
          const chunkContent = result.chunk?.content || ''
          const truncatedContent =
            chunkContent.length > maxChunkLength
              ? chunkContent.substring(0, maxChunkLength) + '...'
              : chunkContent

          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          return `Document ${index + 1} (${result.chunk?.metadata?.documentName || 'Unknown'}): ${truncatedContent}`
        })
        .join('\n\n')

      const userMessage = `Context:\n${contextText}\n\nQuestion: ${request.message}`

      // 5. Stream response from OpenAI (use gpt-3.5-turbo for better token efficiency)
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: true,
        temperature: 0.1,
      })

      let fullResponse = ''

      // Stream chunks to the callback
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          fullResponse += content

          // Send content as received from OpenAI for true streaming
          onChunk({
            type: 'message',
            content: content,
          })
        }
      }

      // Send completion signal with sources
      const sources = filteredChunks.map((result) => ({
        documentId: result.chunk?.documentId || '',
        documentName:
          (result.chunk?.metadata?.documentName as string) ||
          'Unknown Document',
        chunkId: result.chunkId,
        relevanceScore: result.score,
      }))

      onChunk({
        type: 'message',
        content: '',
        sources,
      })

      const processingTime = Date.now() - startTime

      logger.info('Streaming RAG response completed', {
        chunksUsed: filteredChunks.length,
        responseLength: fullResponse.length,
        processingTime,
      })

      return {
        answer: fullResponse,
        referencedChunks: filteredChunks.map((result) => ({
          chunkId: result.chunkId,
          score: result.score,
          content: result.chunk?.content || '',
        })),
      }
    } catch (error) {
      logger.error('Streaming RAG response generation failed:', error)

      onChunk({
        type: 'error',
        content: 'Failed to generate response',
      })

      throw new Error(
        `Failed to generate streaming response: ${error instanceof Error ? error.message : 'Unknown error'}`
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
