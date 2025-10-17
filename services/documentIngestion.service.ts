import fs from 'node:fs'
import { v4 as uuidv4 } from 'uuid'

import type { Chunk, Document, EmbeddingModel } from '../types/types'
import { EmbeddingService } from './embedding.service'
import { FileStorage } from './fileStorage.service'
import { VectorDatabaseService } from './vectorDatabase.enhanced.service'

export class DocumentIngestionService {
  private embeddingService: EmbeddingService
  private storage: FileStorage
  private vectorDb: VectorDatabaseService
  private chunkSize: number
  private overlapSize: number

  constructor(embeddingModel?: EmbeddingModel) {
    this.embeddingService = new EmbeddingService(embeddingModel)
    this.storage = new FileStorage()
    this.vectorDb = VectorDatabaseService.getGlobalInstance()
    this.chunkSize = 2000 // Maximum characters per chunk
    this.overlapSize = 200 // Overlap between consecutive chunks
  }

  /**
   * Extract text from PDF file
   */
  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath)
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
      const pdfParse = require('pdf-parse')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const result = await pdfParse(dataBuffer)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
      return result.text
    } catch (error) {
      throw new Error(
        `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Extract text from text file
   */
  extractTextFromFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch (error) {
      throw new Error(
        `Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Process document and extract text based on type
   */
  async processDocument(document: Document): Promise<string> {
    let text: string

    switch (document.type) {
      case 'pdf':
        text = await this.extractTextFromPDF(
          document.metadata?.filePath as string
        )
        break
      case 'text':
        text = this.extractTextFromFile(document.metadata?.filePath as string)
        break
      default:
        throw new Error(`Unsupported document type: ${document.type}`)
    }

    // Clean up text
    return this.cleanText(text)
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^\s+|\s+$/g, '') // Trim
  }

  /**
   * Split text into chunks with overlap
   */
  chunkText(
    text: string,
    documentId: string,
    documentName: string,
    documentType: 'pdf' | 'text'
  ): Chunk[] {
    const chunks: Chunk[] = []
    const textLength = text.length

    if (textLength === 0) {
      return chunks
    }

    let startIdx = 0
    let chunkIndex = 0

    while (startIdx < textLength) {
      // Calculate end index for current chunk
      let endIdx = Math.min(startIdx + this.chunkSize, textLength)

      // If not at the end of text, try to find a good breaking point
      if (endIdx < textLength) {
        // Look for sentence boundaries (., !, ?) within the last 100 characters
        const searchStart = Math.max(startIdx, endIdx - 100)
        const searchText = text.slice(searchStart, endIdx)

        const sentenceEnd = searchText.match(/[.!?]\s/)
        if (sentenceEnd && sentenceEnd.index !== undefined) {
          endIdx = searchStart + sentenceEnd.index + 1
        } else {
          // Fall back to word boundary
          const wordBoundary = searchText.match(/\s/)
          if (wordBoundary && wordBoundary.index !== undefined) {
            endIdx = searchStart + wordBoundary.index
          }
        }
      }

      // Extract chunk text
      const chunkText = text.slice(startIdx, endIdx).trim()

      if (chunkText.length > 0) {
        const chunk: Chunk = {
          id: uuidv4(),
          documentId,
          content: chunkText,
          index: chunkIndex,
          startPosition: startIdx,
          endPosition: endIdx,
          metadata: {
            documentName,
            documentType,
          },
        }

        chunks.push(chunk)
        chunkIndex++
      }

      // Calculate next start position with overlap
      if (endIdx >= textLength) {
        break
      }

      startIdx = Math.max(endIdx - this.overlapSize, startIdx + 1)
    }

    return chunks
  }

  /**
   * Generate embeddings for chunks
   */
  async generateEmbeddings(chunks: Chunk[]): Promise<Chunk[]> {
    const chunksWithEmbeddings: Chunk[] = []

    for (const chunk of chunks) {
      try {
        const embedding = await this.embeddingService.generateEmbedding(
          chunk.content
        )
        chunksWithEmbeddings.push({
          ...chunk,
          vector: embedding,
        })
      } catch {
        // Continue without embedding for this chunk
        chunksWithEmbeddings.push(chunk)
      }
    }

    return chunksWithEmbeddings
  }

  /**
   * Save chunks to storage and add to vector database
   */
  saveChunks(chunks: Chunk[]): void {
    try {
      // Save chunks to file storage
      this.storage.saveChunks(chunks)

      // Add chunks to vector database
      try {
        this.vectorDb.addVectors(chunks)
      } catch {
        // Vector DB is optional - log but don't fail
        // Error handling is done in VectorDatabaseService
      }
    } catch (error) {
      throw new Error(
        `Failed to save chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Full document ingestion pipeline
   */
  async ingestDocument(document: Document): Promise<Chunk[]> {
    // 1. Extract text from document
    const text = await this.processDocument(document)

    // 2. Update document with extracted content
    this.storage.updateDocument(document.id, { content: text })

    // 3. Chunk the text with overlap
    const chunks = this.chunkText(
      text,
      document.id,
      document.name,
      document.type
    )

    if (chunks.length === 0) {
      throw new Error('No text chunks generated from document')
    }

    // 4. Generate embeddings for chunks
    const chunksWithEmbeddings = await this.generateEmbeddings(chunks)

    // 5. Save chunks to database and vector store
    this.saveChunks(chunksWithEmbeddings)

    return chunksWithEmbeddings
  }

  /**
   * Delete all chunks for a document from storage and vector database
   */
  deleteDocumentChunks(documentId: string): void {
    try {
      // Delete from file storage
      this.storage.deleteChunksByDocumentId(documentId)

      // Delete from vector database
      try {
        this.vectorDb.removeDocumentVectors(documentId)
      } catch {
        // Vector DB is optional - continue even if deletion fails
        // Error handling is done in VectorDatabaseService
      }
    } catch (error) {
      throw new Error(
        `Failed to delete chunks for document ${documentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
