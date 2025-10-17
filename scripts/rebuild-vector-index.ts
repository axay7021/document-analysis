#!/usr/bin/env tsx

import { FileStorage } from '../services/fileStorage.service'
import { VectorDatabaseService } from '../services/vectorDatabase.service'
import type { Chunk } from '../types/types'
import logger from '../utils/logger'

/**
 * Script to rebuild the vector database index from existing chunks
 */
function rebuildVectorIndex(): void {
  try {
    logger.info('Starting vector database rebuild...')

    // Initialize services
    const fileStorage = new FileStorage()
    const vectorDb = new VectorDatabaseService()

    // Initialize vector database
    vectorDb.initialize()

    // Get all documents
    const allDocuments = fileStorage.getAllDocuments()
    logger.info(`Found ${allDocuments.length} documents`)

    // Collect all chunks with vectors
    const allChunks: Chunk[] = []

    for (const doc of allDocuments) {
      const chunks = fileStorage.getChunksByDocumentId(doc.id)
      const chunksWithVectors = chunks.filter(
        (chunk) => chunk.vector && chunk.vector.length > 0
      )

      logger.info(
        `Document ${doc.name} (${doc.id}): ${chunks.length} chunks, ${chunksWithVectors.length} with vectors`
      )

      allChunks.push(...chunksWithVectors)
    }

    logger.info(`Total chunks with vectors: ${allChunks.length}`)

    if (allChunks.length === 0) {
      logger.warn(
        'No chunks with vectors found. Make sure documents have been processed and embeddings generated.'
      )
      return
    }

    // Add all vectors to the database
    vectorDb.addVectors(allChunks)

    // Get final stats
    const stats = vectorDb.getStats()
    logger.info('Vector database rebuilt successfully:', stats)
  } catch (error) {
    logger.error('Failed to rebuild vector database:', error)
    throw error
  }
}

// Run the script if executed directly
if (require.main === module) {
  try {
    rebuildVectorIndex()
    logger.info('Vector database rebuild completed successfully')
    process.exit(0)
  } catch (error: unknown) {
    logger.error('Vector database rebuild failed:', error)
    process.exit(1)
  }
}

export { rebuildVectorIndex }
