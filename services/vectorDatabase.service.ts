import { IndexFlatIP } from 'faiss-node'
import fs from 'node:fs'
import path from 'node:path'

import config from '../config'
import type { Chunk, VectorSearchResult } from '../types/types'
import logger from '../utils/logger'
import { FileStorage } from './fileStorage.service'

export class VectorDatabaseService {
  private index: IndexFlatIP | null = null
  private chunkIdMap: Map<number, string> = new Map()
  private indexPath: string
  private isInitialized = false
  private fileStorage: FileStorage

  constructor() {
    this.indexPath = path.join(config.FAISS_INDEX_PATH, 'document_index')
    this.fileStorage = new FileStorage()
  }

  /**
   * Initialize the vector database
   */
  initialize(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.indexPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Try to load existing index
      if (fs.existsSync(`${this.indexPath}.index`)) {
        this.loadIndex()
      } else {
        // Create new index with OpenAI embedding dimensions (1536)
        this.index = new IndexFlatIP(1536)
        this.loadChunkMappings()
      }

      this.isInitialized = true
      logger.info('Vector database initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize vector database:', error)
      throw error
    }
  }

  /**
   * Add vectors to the index
   */
  addVectors(chunks: Chunk[]): void {
    if (!this.index) {
      throw new Error('Vector database not initialized')
    }

    const vectors: number[][] = []
    const chunkIds: string[] = []

    for (const chunk of chunks) {
      if (chunk.vector && chunk.vector.length > 0) {
        vectors.push(chunk.vector)
        chunkIds.push(chunk.id)
      }
    }

    if (vectors.length === 0) {
      return
    }

    // Add vectors to FAISS index
    const startIdx = this.index.ntotal()

    // FAISS expects a flat array, so we need to flatten the 2D array
    const flatVectors = vectors.flat()
    this.index.add(flatVectors)

    // Update chunk ID mapping
    for (let i = 0; i < chunkIds.length; i++) {
      this.chunkIdMap.set(startIdx + i, chunkIds[i])
    }

    // Save index and mappings
    this.saveIndex()
    this.saveChunkMappings()
  }

  /**
   * Search for similar vectors
   */
  searchSimilar(
    queryVector: number[],
    limit = 5,
    minScore = 0.5
  ): VectorSearchResult[] {
    if (!this.index || !this.isInitialized) {
      throw new Error('Vector database not initialized')
    }

    if (this.index.ntotal() === 0) {
      return []
    }

    try {
      // Search in FAISS index
      const results = this.index.search(
        queryVector,
        Math.min(limit, this.index.ntotal())
      )

      const searchResults: VectorSearchResult[] = []

      for (let i = 0; i < results.labels.length; i++) {
        const score = results.distances[i]
        const indexId = results.labels[i]
        const chunkId = this.chunkIdMap.get(indexId)

        if (chunkId && score >= minScore) {
          // Get chunk from file storage
          // We need to search through documents to find the chunk
          const allDocuments = this.fileStorage.getAllDocuments()
          let chunk: Chunk | null = null

          for (const doc of allDocuments) {
            const chunks = this.fileStorage.getChunksByDocumentId(doc.id)
            const foundChunk = chunks.find((c) => c.id === chunkId)
            if (foundChunk) {
              chunk = foundChunk
              break
            }
          }

          if (chunk) {
            searchResults.push({
              chunkId,
              score,
              chunk,
            })
          }
        }
      }

      return searchResults.sort((a, b) => b.score - a.score)
    } catch (error) {
      logger.error('Vector search failed:', error)
      throw new Error('Failed to search vectors')
    }
  }

  /**
   * Remove vectors for a document
   */
  removeDocumentVectors(documentId: string): void {
    // For FAISS, we need to rebuild the index when removing vectors
    // This is a simplified approach - in production, you might want to use a more efficient method

    try {
      // Get all chunks except the ones to remove
      const allDocuments = this.fileStorage.getAllDocuments()
      const remainingChunks: Chunk[] = []

      for (const doc of allDocuments) {
        if (doc.id !== documentId) {
          const chunks = this.fileStorage.getChunksByDocumentId(doc.id)
          remainingChunks.push(...chunks.filter((chunk) => chunk.embedding))
        }
      }

      // Rebuild index
      this.index = new IndexFlatIP(1536)
      this.chunkIdMap.clear()

      if (remainingChunks.length > 0) {
        this.addVectors(remainingChunks)
      }

      logger.info(`Removed vectors for document ${documentId}`)
    } catch (error) {
      logger.error('Failed to remove document vectors:', error)
      throw error
    }
  }

  /**
   * Save FAISS index to disk
   */
  private saveIndex(): void {
    if (!this.index) return

    try {
      this.index.write(`${this.indexPath}.index`)
    } catch (error) {
      logger.error('Failed to save FAISS index:', error)
      throw error
    }
  }

  /**
   * Load FAISS index from disk
   */
  private loadIndex(): void {
    try {
      this.index = IndexFlatIP.read(`${this.indexPath}.index`)
      this.loadChunkMappings()
    } catch (error) {
      logger.error('Failed to load FAISS index:', error)
      throw error
    }
  }

  /**
   * Save chunk ID mappings to disk
   */
  private saveChunkMappings(): void {
    try {
      const mappingData = JSON.stringify(Array.from(this.chunkIdMap.entries()))
      fs.writeFileSync(`${this.indexPath}.mapping`, mappingData)
    } catch (error) {
      logger.error('Failed to save chunk mappings:', error)
      throw error
    }
  }

  /**
   * Load chunk ID mappings from disk
   */
  private loadChunkMappings(): void {
    try {
      const mappingPath = `${this.indexPath}.mapping`
      if (fs.existsSync(mappingPath)) {
        const mappingData = fs.readFileSync(mappingPath, 'utf-8')
        const entries = JSON.parse(mappingData) as [number, string][]
        this.chunkIdMap = new Map(entries)
      }
    } catch (error) {
      logger.error('Failed to load chunk mappings:', error)
      // Not critical, we can continue with empty mappings
    }
  }

  /**
   * Delete vectors by document ID
   * Note: FAISS doesn't support efficient deletion, so this recreates the index
   */
  deleteVectorsByDocumentId(documentId: string): void {
    if (!this.index || !this.isInitialized) {
      throw new Error('Vector database not initialized')
    }

    try {
      // Get all chunks that don't belong to this document
      const fileStorage = new FileStorage()
      const allDocuments = fileStorage.getAllDocuments()
      const remainingChunks: Chunk[] = []

      // Collect all chunks from documents that are not being deleted
      for (const doc of allDocuments) {
        if (doc.id !== documentId) {
          const chunks = fileStorage.getChunksByDocumentId(doc.id)
          remainingChunks.push(...chunks)
        }
      }

      // Recreate the index with remaining chunks
      this.index = new IndexFlatIP(1536)
      this.chunkIdMap.clear()

      if (remainingChunks.length > 0) {
        this.addVectors(remainingChunks)
      }

      logger.info(
        `Deleted vectors for document ${documentId}, ${remainingChunks.length} vectors remaining`
      )
    } catch (error) {
      logger.error(
        `Failed to delete vectors for document ${documentId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Get database statistics
   */
  getStats(): { totalVectors: number; mappingsCount: number } {
    return {
      totalVectors: this.index?.ntotal() || 0,
      mappingsCount: this.chunkIdMap.size,
    }
  }
}
