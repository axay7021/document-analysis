import OpenAI from 'openai'

import config from '../config'
import { createAIClient } from './aiProvider'
import type { EmbeddingModel } from '../types/types'

export class EmbeddingService {
  private openai: OpenAI | null
  private model: EmbeddingModel

  constructor(embeddingModel?: EmbeddingModel) {
    this.openai = createAIClient()

    this.model = embeddingModel || {
      name:
        config.AI_EMBEDDING_MODEL ||
        (config.AI_PROVIDER === 'google'
          ? 'gemini-embedding-001'
          : 'text-embedding-ada-002'),
      dimensions: 1536,
      maxTokens: config.AI_PROVIDER === 'google' ? 2048 : 8000,
      provider: config.AI_PROVIDER === 'google' ? 'google' : 'openai',
    }
  }

  /**
   * Generate embedding for a text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai)
      throw new Error('AI service is not configured for the selected provider')
    try {
      // Validate input text
      if (!text || typeof text !== 'string') {
        throw new Error('Text input is required and must be a string')
      }

      // Truncate text if it exceeds model limits
      const truncatedText = this.truncateText(text)

      const response = await this.openai.embeddings.create({
        model: this.model.name,
        ...(this.model.provider === 'google'
          ? { dimensions: this.model.dimensions }
          : {}),
        input: truncatedText,
      })

      return this.validateEmbedding(response.data[0].embedding)
    } catch (error) {
      console.error('Failed to generate embedding:', error)
      throw new Error(
        `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai)
      throw new Error('AI service is not configured for the selected provider')
    try {
      const truncatedTexts = texts.map((text) => this.truncateText(text))

      const response = await this.openai.embeddings.create({
        model: this.model.name,
        ...(this.model.provider === 'google'
          ? { dimensions: this.model.dimensions }
          : {}),
        input: truncatedTexts,
      })

      if (response.data.length !== texts.length)
        throw new Error('Embedding response count does not match input count')
      return response.data.map((item) => this.validateEmbedding(item.embedding))
    } catch (error) {
      console.error('Failed to generate batch embeddings:', error)
      throw new Error(
        `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private validateEmbedding(vector: number[]): number[] {
    if (
      vector.length !== this.model.dimensions ||
      vector.some((value) => !Number.isFinite(value))
    ) {
      throw new Error('Embedding dimensions do not match the vector index')
    }
    if (this.model.provider !== 'google') return vector
    const norm = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0)
    )
    if (!norm) throw new Error('Embedding vector has zero length')
    return vector.map((value) => value / norm)
  }

  /**
   * Truncate text to fit within model token limits
   */
  private truncateText(text: string): string {
    // Validate input
    if (!text || typeof text !== 'string') {
      return ''
    }

    // Rough estimate: 1 token ≈ 4 characters for English text
    const maxCharacters = (this.model.maxTokens || 8000) * 4

    if (text.length <= maxCharacters) {
      return text
    }

    return text.slice(0, maxCharacters)
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions')
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }
}
