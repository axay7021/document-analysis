#!/usr/bin/env ts-node

import { EmbeddingService } from '../services/embedding.service'
import { FileStorage } from '../services/fileStorage.service'
import { VectorDatabaseService } from '../services/vectorDatabase.service'
import type { Chunk } from '../types/types'
import logger from '../utils/logger'

/**
 * Utility script to rebuild the FAISS vector database from existing chunks
 * This is useful when chunks exist but the vector database is empty or corrupted
 */
async function rebuildVectorDatabase(): Promise<void> {
  logger.info('Starting vector database rebuild...')

  try {
    // Initialize services
    const fileStorage = new FileStorage()
    const vectorService = new VectorDatabaseService()
    const embeddingService = new EmbeddingService()

    // Initialize vector database
    vectorService.initialize()

    // Get all documents
    const documents = fileStorage.getAllDocuments()
    logger.info(`Found ${documents.length} documents`)

    if (documents.length === 0) {
      logger.warn('No documents found. Nothing to rebuild.')
      return
    }

    let totalChunksProcessed = 0
    let totalChunksWithErrors = 0

    // Process each document
    for (const document of documents) {
      logger.info(`Processing document: ${document.name} (${document.id})`)

      try {
        // Get chunks for this document
        const chunks = fileStorage.getChunksByDocumentId(document.id)
        logger.info(
          `Found ${chunks.length} chunks for document ${document.name}`
        )

        if (chunks.length === 0) {
          logger.warn(`No chunks found for document ${document.id}`)
          continue
        }

        // Generate embeddings for each chunk and create chunks with vectors
        const chunksWithVectors: Chunk[] = []

        for (const chunk of chunks) {
          try {
            logger.info(`Generating embedding for chunk ${chunk.id}...`)
            const embedding = await embeddingService.generateEmbedding(
              chunk.content
            )

            // Create chunk with vector
            const chunkWithVector: Chunk = {
              ...chunk,
              vector: embedding,
            }

            chunksWithVectors.push(chunkWithVector)
            logger.info(`Generated embedding for chunk ${chunk.id}`)
          } catch (chunkError) {
            logger.error(
              `Failed to generate embedding for chunk ${chunk.id}:`,
              chunkError
            )
          }
        }

        if (chunksWithVectors.length > 0) {
          // Add chunks with vectors to the database
          vectorService.addVectors(chunksWithVectors)
          totalChunksProcessed += chunksWithVectors.length
          logger.info(
            `Successfully processed ${chunksWithVectors.length} chunks for document ${document.name}`
          )
        }
      } catch (error) {
        logger.error(`Failed to process document ${document.name}:`, error)
        totalChunksWithErrors++
      }
    }

    // Get final statistics
    const stats = vectorService.getStats()

    logger.info('Vector database rebuild completed!')
    logger.info(`Total chunks processed: ${totalChunksProcessed}`)
    logger.info(`Total documents with errors: ${totalChunksWithErrors}`)
    logger.info('Final vector database stats:', stats)

    if (stats.totalVectors === 0) {
      logger.error('ERROR: No vectors were added to the database!')
      process.exit(1)
    }
  } catch (error) {
    logger.error('Vector database rebuild failed:', error)
    process.exit(1)
  }
}

// Main execution
if (require.main === module) {
  rebuildVectorDatabase()
    .then(() => {
      logger.info('Script completed successfully')
      process.exit(0)
    })
    .catch((error: unknown) => {
      logger.error('Script failed:', error)
      process.exit(1)
    })
}

export { rebuildVectorDatabase }
