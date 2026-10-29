import OpenAI from 'openai'

import config from '../config'
import type { EmbeddingModel } from '../types/types'

export class EmbeddingService {
  private openai: OpenAI | null
  private model: EmbeddingModel

  constructor(embeddingModel?: EmbeddingModel) {
    this.openai = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null

    this.model = embeddingModel || {
      name: 'text-embedding-ada-002',
      dimensions: 1536,
      maxTokens: 8000,
      provider: 'openai',
    }
  }

  /**
   * Generate embedding for a text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) throw new Error('AI service not configured: OPENAI_API_KEY is empty')
    try {
      // Validate input text
      if (!text || typeof text !== 'string') {
        throw new Error('Text input is required and must be a string')
      }

      // Truncate text if it exceeds model limits
      const truncatedText = this.truncateText(text)

      const response = await this.openai.embeddings.create({
        model: this.model.name,
        input: truncatedText,
      })

      return response.data[0].embedding
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
    if (!this.openai) throw new Error('AI service not configured: OPENAI_API_KEY is empty')
    try {
      const truncatedTexts = texts.map((text) => this.truncateText(text))

      const response = await this.openai.embeddings.create({
        model: this.model.name,
        input: truncatedTexts,
      })

      return response.data.map((item) => item.embedding)
    } catch (error) {
      console.error('Failed to generate batch embeddings:', error)
      throw new Error(
        `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
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
