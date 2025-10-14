#!/usr/bin/env ts-node

import { EmbeddingService } from '../services/embedding.service'
import { FileStorage } from '../services/fileStorage.service'
import { VectorDatabaseService } from '../services/vectorDatabase.service'
import type { Chunk } from '../types/types'
import logger from '../utils/logger'

/**
 * Rebuild vector database using existing chunks with correct IDs
 */
async function rebuildVectorDatabaseFromExistingChunks(): Promise<void> {
  logger.info('Rebuilding vector database from existing chunks...')

  try {
    // Initialize services
    const fileStorage = new FileStorage()
    const vectorService = new VectorDatabaseService()
    const embeddingService = new EmbeddingService()

    // Initialize vector database (this will create a fresh index)
    vectorService.initialize()

    // Get all documents and their chunks
    const documents = fileStorage.getAllDocuments()
    logger.info(`Found ${documents.length} documents`)

    let allChunks: Chunk[] = []

    // Collect all existing chunks
    for (const document of documents) {
      const chunks = fileStorage.getChunksByDocumentId(document.id)
      logger.info(`Document ${document.name}: ${chunks.length} chunks`)
      allChunks.push(...chunks)
    }

    logger.info(`Total chunks to process: ${allChunks.length}`)

    if (allChunks.length === 0) {
      logger.warn('No chunks found. Nothing to rebuild.')
      return
    }

    // Generate embeddings for chunks that don't have them
    const chunksWithEmbeddings: Chunk[] = []

    for (const chunk of allChunks) {
      if (chunk.vector && chunk.vector.length > 0) {
        // Chunk already has embedding
        chunksWithEmbeddings.push(chunk)
        logger.info(`Chunk ${chunk.id} already has embedding`)
      } else {
        // Generate embedding for chunk
        try {
          logger.info(`Generating embedding for chunk ${chunk.id}...`)
          const embedding = await embeddingService.generateEmbedding(
            chunk.content
          )

          const chunkWithVector: Chunk = {
            ...chunk,
            vector: embedding,
          }

          chunksWithEmbeddings.push(chunkWithVector)

          // Save the updated chunk back to storage
          fileStorage.saveChunks([chunkWithVector])
        } catch (error) {
          logger.error(
            `Failed to generate embedding for chunk ${chunk.id}:`,
            error
          )
        }
      }
    }

    if (chunksWithEmbeddings.length > 0) {
      // Add all chunks with embeddings to vector database
      vectorService.addVectors(chunksWithEmbeddings)

      const stats = vectorService.getStats()

      logger.info('Vector database rebuilt successfully!')
      logger.info(`Total chunks processed: ${chunksWithEmbeddings.length}`)
      logger.info('Final vector database stats:', stats)

      if (stats.totalVectors === 0) {
        logger.error('ERROR: No vectors were added to the database!')
        process.exit(1)
      } else {
        logger.info(`SUCCESS: ${stats.totalVectors} vectors ready for search!`)
      }
    } else {
      logger.error('No chunks with embeddings were created!')
      process.exit(1)
    }
  } catch (error) {
    logger.error('Vector database rebuild failed:', error)
    process.exit(1)
  }
}

// Main execution
if (require.main === module) {
  rebuildVectorDatabaseFromExistingChunks()
    .then(() => {
      logger.info('Script completed successfully')
      process.exit(0)
    })
    .catch((error: unknown) => {
      logger.error('Script failed:', error)
      process.exit(1)
    })
}

export { rebuildVectorDatabaseFromExistingChunks }
