#!/usr/bin/env ts-node

import { DocumentIngestionService } from '../services/documentIngestion.service'
import { FileStorage } from '../services/fileStorage.service'
import { VectorDatabaseService } from '../services/vectorDatabase.service'
import logger from '../utils/logger'

/**
 * Process all existing documents that haven't been ingested yet
 * This will extract text, create chunks, and add embeddings to the vector database
 */
async function processExistingDocuments(): Promise<void> {
  logger.info('Starting document processing for existing documents...')

  try {
    // Initialize services
    const fileStorage = new FileStorage()
    const ingestionService = new DocumentIngestionService()
    const vectorService = new VectorDatabaseService()

    // Initialize vector database
    vectorService.initialize()

    // Get all documents
    const documents = fileStorage.getAllDocuments()
    logger.info(`Found ${documents.length} documents to process`)

    if (documents.length === 0) {
      logger.warn('No documents found to process.')
      return
    }

    let totalProcessed = 0
    let totalFailed = 0

    // Process each document
    for (const document of documents) {
      logger.info(`Processing document: ${document.name} (${document.id})`)

      try {
        // Check if document already has content (already processed)
        if (document.content && document.content.trim().length > 0) {
          logger.info(
            `Document ${document.name} already has content, skipping text extraction`
          )

          // Check if chunks exist
          const existingChunks = fileStorage.getChunksByDocumentId(document.id)
          if (existingChunks.length > 0) {
            logger.info(
              `Document ${document.name} already has ${existingChunks.length} chunks, skipping`
            )
            continue
          }
        }

        // Process the document through full ingestion pipeline
        const chunks = await ingestionService.ingestDocument(document)

        totalProcessed++
        logger.info(
          `Successfully processed document ${document.name}: ${chunks.length} chunks created`
        )
      } catch (error) {
        logger.error(`Failed to process document ${document.name}:`, error)
        totalFailed++
      }
    }

    // Get final statistics
    const stats = vectorService.getStats()

    logger.info('Document processing completed!')
    logger.info(`Total documents processed: ${totalProcessed}`)
    logger.info(`Total documents failed: ${totalFailed}`)
    logger.info('Final vector database stats:', stats)

    if (stats.totalVectors === 0) {
      logger.error('WARNING: No vectors were added to the database!')
    } else {
      logger.info(
        `SUCCESS: ${stats.totalVectors} vectors now available for search!`
      )
    }
  } catch (error) {
    logger.error('Document processing failed:', error)
    process.exit(1)
  }
}

// Main execution
if (require.main === module) {
  processExistingDocuments()
    .then(() => {
      logger.info('Document processing script completed successfully')
      process.exit(0)
    })
    .catch((error: unknown) => {
      logger.error('Document processing script failed:', error)
      process.exit(1)
    })
}

export { processExistingDocuments }
