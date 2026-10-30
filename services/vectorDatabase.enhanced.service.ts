import { IndexFlatIP } from 'faiss-node'
import fs from 'node:fs'
import path from 'node:path'

import config from '../config'
import type { Chunk, VectorSearchResult } from '../types/types'
import logger from '../utils/logger'
import { FileStorage } from './fileStorage.service'

/**
 * Enhanced Vector Database Service with proper synchronization
 * Addresses the common issues of index becoming inconsistent with file system
 */
export class VectorDatabaseService {
  private static globalInstance: VectorDatabaseService | null = null
  private static isGloballyInitialized = false

  private index: IndexFlatIP | null = null
  private chunkIdMap: Map<number, string> = new Map()
  private indexPath: string
  private isInitialized = false
  private fileStorage: FileStorage
  private lastSyncCheck = 0
  private readonly SYNC_CHECK_INTERVAL = 30000 // 30 seconds

  constructor() {
    this.indexPath = path.join(config.FAISS_INDEX_PATH, 'document_index')
    this.fileStorage = new FileStorage()
  }

  /**
   * Get or create the global instance (singleton pattern)
   * This ensures all services share the same vector database instance
   */
  static getGlobalInstance(): VectorDatabaseService {
    if (!VectorDatabaseService.globalInstance) {
      VectorDatabaseService.globalInstance = new VectorDatabaseService()
    }
    return VectorDatabaseService.globalInstance
  }

  /**
   * Initialize the vector database with comprehensive synchronization
   */
  initialize(): void {
    try {
      // If this instance is already initialized, return
      if (this.isInitialized) {
        return
      }

      // If we're using the global instance and it's already initialized, sync state
      if (
        this === VectorDatabaseService.globalInstance &&
        VectorDatabaseService.isGloballyInitialized
      ) {
        this.isInitialized = true
        return
      }

      logger.info('Initializing vector database...')

      // Ensure directory exists
      const dir = path.dirname(this.indexPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Load or create index with verification
      this.loadOrCreateIndexWithVerification()

      this.isInitialized = true
      if (this === VectorDatabaseService.globalInstance) {
        VectorDatabaseService.isGloballyInitialized = true
      }

      logger.info('Vector database initialized successfully', {
        totalVectors: this.index?.ntotal() || 0,
        mappingsCount: this.chunkIdMap.size,
      })
    } catch (error) {
      logger.error('Failed to initialize vector database:', error)
      throw error
    }
  }

  /**
   * Load existing index or create new one with full verification
   */
  private loadOrCreateIndexWithVerification(): void {
    const indexExists = fs.existsSync(`${this.indexPath}.index`)
    const mappingExists = fs.existsSync(`${this.indexPath}.mapping`)

    if (indexExists && mappingExists) {
      // Load existing index
      this.loadIndex()

      // Verify consistency and rebuild if needed
      const isConsistent = this.verifyIndexConsistency()
      if (!isConsistent) {
        logger.warn('Index inconsistency detected, rebuilding...')
        this.rebuildIndexFromFileSystem()
      }
    } else {
      // Create new index from scratch
      this.createNewIndexFromFileSystem()
    }
  }

  /**
   * Verify that the loaded index matches the current file system state
   */
  private verifyIndexConsistency(): boolean {
    if (!this.index) return false

    const currentVectorCount = this.index.ntotal()
    const mappingCount = this.chunkIdMap.size

    // Basic sanity checks
    if (currentVectorCount !== mappingCount || currentVectorCount === 0) {
      logger.warn('Index vector count mismatch with mappings', {
        vectorCount: currentVectorCount,
        mappingCount: mappingCount,
      })
      return false
    }

    // Check if file system has different number of chunks
    const fileSystemChunkCount = this.getFileSystemChunkCount()
    if (fileSystemChunkCount !== currentVectorCount) {
      logger.warn('Index vector count mismatch with file system', {
        indexCount: currentVectorCount,
        fileSystemCount: fileSystemChunkCount,
      })
      return false
    }

    const storedIds = new Set(
      this.fileStorage
        .getAllDocuments()
        .flatMap((doc) =>
          this.fileStorage
            .getChunksByDocumentId(doc.id)
            .map((chunk) => chunk.id)
        )
    )
    if ([...this.chunkIdMap.values()].some((id) => !storedIds.has(id))) {
      return false
    }

    return true
  }

  /**
   * Count chunks with vectors in the file system
   */
  private getFileSystemChunkCount(): number {
    const allDocuments = this.fileStorage.getAllDocuments()
    let count = 0

    for (const doc of allDocuments) {
      const chunks = this.fileStorage.getChunksByDocumentId(doc.id)
      count += chunks.filter(
        (chunk) => chunk.vector && chunk.vector.length === 1536
      ).length
    }

    return count
  }

  /**
   * Create completely new index from file system chunks
   */
  private createNewIndexFromFileSystem(): void {
    this.index = new IndexFlatIP(1536)
    this.chunkIdMap.clear()
    this.rebuildIndexFromFileSystem()
  }

  /**
   * Rebuild index from all chunks in file system
   */
  private rebuildIndexFromFileSystem(): void {
    if (!this.index) return

    logger.info('Rebuilding vector index from file system...')

    // Clear current state
    this.index = new IndexFlatIP(1536)
    this.chunkIdMap.clear()

    // Get all chunks with vectors from file system
    const allDocuments = this.fileStorage.getAllDocuments()
    const allChunksWithVectors: Chunk[] = []

    for (const doc of allDocuments) {
      const chunks = this.fileStorage.getChunksByDocumentId(doc.id)
      const chunksWithVectors = chunks.filter(
        (chunk) => chunk.vector && chunk.vector.length === 1536
      )
      allChunksWithVectors.push(...chunksWithVectors)
    }

    if (allChunksWithVectors.length > 0) {
      this.addVectorsInternal(allChunksWithVectors)
      logger.info(`Rebuilt index with ${allChunksWithVectors.length} vectors`)
    } else {
      logger.info('No chunks with vectors found in file system')
    }

    // Persist the rebuilt index
    this.saveIndex()
    this.saveChunkMappings()
  }

  /**
   * Add vectors to the index (internal method without persistence)
   */
  private addVectorsInternal(chunks: Chunk[]): void {
    if (!this.index) {
      throw new Error('Vector database not initialized')
    }

    const vectors: number[][] = []
    const chunkIds: string[] = []

    for (const chunk of chunks) {
      if (chunk.vector && chunk.vector.length === 1536) {
        vectors.push(chunk.vector)
        chunkIds.push(chunk.id)
      }
    }

    if (vectors.length === 0) {
      return
    }

    // Add vectors to FAISS index
    const startIdx = this.index.ntotal()

    // Flatten vectors for FAISS
    const flatVectors: number[] = []
    for (const vector of vectors) {
      flatVectors.push(...vector)
    }

    this.index.add(flatVectors)

    // Update chunk ID mapping
    for (let i = 0; i < chunkIds.length; i++) {
      this.chunkIdMap.set(startIdx + i, chunkIds[i])
    }
  }

  /**
   * Add vectors to the index (public method)
   */
  addVectors(chunks: Chunk[]): void {
    if (!this.index) {
      throw new Error('Vector database not initialized')
    }

    this.addVectorsInternal(chunks)

    // Save index and mappings
    this.saveIndex()
    this.saveChunkMappings()

    logger.info(`Added ${chunks.length} vectors to index`, {
      totalVectors: this.index.ntotal(),
    })
  }

  /**
   * Search for similar vectors with automatic sync check
   */
  searchSimilar(
    queryVector: number[],
    limit = 5,
    minScore = -1.0,
    documentIds?: string[]
  ): VectorSearchResult[] {
    if (!this.index || !this.isInitialized) {
      throw new Error('Vector database not initialized')
    }

    // Periodic sync check to ensure index is up to date
    const now = Date.now()
    if (now - this.lastSyncCheck > this.SYNC_CHECK_INTERVAL) {
      this.performSyncCheck()
      this.lastSyncCheck = now
    }

    if (this.index.ntotal() === 0) {
      logger.info('Vector database is empty - no vectors to search')
      return []
    }

    try {
      // Search in FAISS index
      const results = this.index.search(
        queryVector,
        documentIds ? this.index.ntotal() : Math.min(limit, this.index.ntotal())
      )

      logger.info('Vector search debug info:', {
        totalVectors: this.index.ntotal(),
        mappingsCount: this.chunkIdMap.size,
        resultsFound: results.labels.length,
        scores: results.distances,
        labels: results.labels,
      })

      const searchResults: VectorSearchResult[] = []
      const allDocuments = this.fileStorage.getAllDocuments()

      for (let i = 0; i < results.labels.length; i++) {
        const score = results.distances[i]
        const indexId = results.labels[i]
        const chunkId = this.chunkIdMap.get(indexId)

        if (chunkId && score >= minScore) {
          // Get chunk from file storage
          let chunk: Chunk | null = null

          for (const doc of allDocuments) {
            const chunks = this.fileStorage.getChunksByDocumentId(doc.id)
            const foundChunk = chunks.find((c) => c.id === chunkId)
            if (foundChunk) {
              chunk = foundChunk
              break
            }
          }

          if (
            chunk &&
            (!documentIds || documentIds.includes(chunk.documentId))
          ) {
            searchResults.push({
              chunkId,
              score,
              chunk,
            })
          } else if (!chunk) {
            logger.warn(`Chunk ${chunkId} not found in file system`)
          }
        }
      }

      return searchResults.sort((a, b) => b.score - a.score).slice(0, limit)
    } catch (error) {
      logger.error('Vector search failed:', error)
      throw new Error('Failed to search vectors')
    }
  }

  /**
   * Perform periodic sync check
   */
  private performSyncCheck(): void {
    try {
      const currentFileSystemCount = this.getFileSystemChunkCount()
      const currentIndexCount = this.index?.ntotal() || 0

      if (currentFileSystemCount !== currentIndexCount) {
        logger.info('Sync check detected mismatch, rebuilding index', {
          fileSystemCount: currentFileSystemCount,
          indexCount: currentIndexCount,
        })
        this.rebuildIndexFromFileSystem()
      }
    } catch (error) {
      logger.error('Sync check failed:', error)
    }
  }

  /**
   * Force rebuild from file system (public method)
   */
  forceRebuild(): void {
    logger.info('Forcing vector database rebuild...')
    this.rebuildIndexFromFileSystem()
  }

  /**
   * Remove vectors for a document
   */
  removeDocumentVectors(documentId: string): void {
    logger.info(`Removing vectors for document ${documentId}`)
    // Simply rebuild the index without this document
    this.rebuildIndexFromFileSystem()
  }

  /**
   * Clear and initialize empty index
   */
  clearAndInitialize(): void {
    try {
      const dir = path.dirname(this.indexPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      this.index = new IndexFlatIP(1536)
      this.chunkIdMap.clear()
      this.isInitialized = true

      logger.info('Vector database cleared and initialized successfully')
    } catch (error) {
      logger.error('Failed to clear and initialize vector database:', error)
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
      // Create new index if loading fails
      this.createNewIndexFromFileSystem()
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
      this.chunkIdMap.clear()
    }
  }
}
