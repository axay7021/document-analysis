#!/usr/bin/env tsx

import { FileStorage } from '../services/fileStorage.service'
import { VectorDatabaseService } from '../services/vectorDatabase.service'
import type { Chunk, Document } from '../types/types'
import logger from '../utils/logger'

interface RebuildStats {
  documents: Document[]
  totalChunks: number
  chunksWithVectors: number
  chunksWithoutVectors: number
}

/**
 * Script to rebuild the vector database index from existing chunks
 */
class VectorIndexRebuilder {
  private fileStorage: FileStorage
  private vectorDb: VectorDatabaseService

  constructor() {
    this.fileStorage = new FileStorage()
    this.vectorDb = new VectorDatabaseService()
  }

  /**
   * Get statistics about documents and chunks
   */
  private getStatistics(): RebuildStats {
    const documents = this.fileStorage.getAllDocuments()
    let totalChunks = 0
    let chunksWithVectors = 0
    let chunksWithoutVectors = 0

    for (const doc of documents) {
      const chunks = this.fileStorage.getChunksByDocumentId(doc.id)
      totalChunks += chunks.length

      for (const chunk of chunks) {
        if (chunk.vector && chunk.vector.length > 0) {
          chunksWithVectors++
        } else {
          chunksWithoutVectors++
        }
      }
    }

    return {
      documents,
      totalChunks,
      chunksWithVectors,
      chunksWithoutVectors,
    }
  }

  /**
   * Display current statistics
   */
  showStats(): void {
    try {
      logger.info('Collecting statistics...')
      const stats = this.getStatistics()

      // Initialize vector database to get current index stats
      this.vectorDb.initialize()
      const vectorStats = this.vectorDb.getStats()

      console.log('\n📊 Vector Database Statistics:')
      console.log('='.repeat(50))
      console.log(`📄 Documents: ${stats.documents.length}`)
      console.log(`📦 Total chunks: ${stats.totalChunks}`)
      console.log(`✅ Chunks with vectors: ${stats.chunksWithVectors}`)
      console.log(`❌ Chunks without vectors: ${stats.chunksWithoutVectors}`)
      console.log(`🔍 Vectors in index: ${vectorStats.totalVectors}`)
      console.log(`🗂️  Chunk mappings: ${vectorStats.mappingsCount}`)

      if (stats.documents.length > 0) {
        console.log('\n📋 Document Details:')
        console.log('-'.repeat(80))
        stats.documents.forEach((doc, index) => {
          const chunks = this.fileStorage.getChunksByDocumentId(doc.id)
          const vectorChunks = chunks.filter(
            (c) => c.vector && c.vector.length > 0
          )
          const percentage =
            chunks.length > 0
              ? ((vectorChunks.length / chunks.length) * 100).toFixed(1)
              : '0'
          console.log(
            `  ${index + 1}. ${doc.name} (${vectorChunks.length}/${chunks.length} chunks vectorized - ${percentage}%)`
          )
        })
      }

      // Health check
      console.log('\n🏥 Health Check:')
      console.log('-'.repeat(30))
      if (vectorStats.totalVectors === 0) {
        console.log('❌ Vector database is empty - rebuild needed')
      } else if (vectorStats.totalVectors !== stats.chunksWithVectors) {
        console.log(
          '⚠️  Mismatch between index and files - rebuild recommended'
        )
      } else {
        console.log('✅ Vector database is healthy')
      }
    } catch (error) {
      logger.error('Failed to get statistics:', error)
    }
  }

  /**
   * Rebuild the entire vector database index
   */
  rebuildComplete(verbose = false): void {
    try {
      logger.info('🚀 Starting complete vector database rebuild...')

      // Get initial statistics
      const stats = this.getStatistics()
      logger.info('📊 Initial Statistics:')
      logger.info(`   Documents: ${stats.documents.length}`)
      logger.info(`   Total chunks: ${stats.totalChunks}`)
      logger.info(`   Chunks with vectors: ${stats.chunksWithVectors}`)
      logger.info(`   Chunks without vectors: ${stats.chunksWithoutVectors}`)

      if (stats.chunksWithVectors === 0) {
        logger.warn('⚠️  No chunks with vectors found!')
        logger.warn(
          '   Make sure documents have been processed and embeddings generated.'
        )
        logger.warn(
          '   You may need to run document ingestion first to generate embeddings.'
        )
        return
      }

      // Initialize vector database (this clears existing index)
      logger.info('🔧 Clearing and initializing vector database...')
      this.vectorDb.clearAndInitialize()

      // Collect all chunks with vectors
      const allChunksWithVectors: Chunk[] = []
      let processedDocs = 0

      logger.info('📦 Collecting chunks with vectors...')
      for (const doc of stats.documents) {
        const chunks = this.fileStorage.getChunksByDocumentId(doc.id)
        const chunksWithVectors = chunks.filter(
          (chunk) => chunk.vector && chunk.vector.length > 0
        )

        if (verbose || chunksWithVectors.length > 0) {
          logger.info(
            `   Processing: ${doc.name} (${chunksWithVectors.length}/${chunks.length} vectorized)`
          )
        }

        allChunksWithVectors.push(...chunksWithVectors)
        processedDocs++

        // Show progress for large collections
        if (processedDocs % 10 === 0 && stats.documents.length > 10) {
          logger.info(
            `   Progress: ${processedDocs}/${stats.documents.length} documents processed`
          )
        }
      }

      logger.info(
        `✅ Collected ${allChunksWithVectors.length} chunks with vectors`
      )

      // Add all vectors to the database
      if (allChunksWithVectors.length > 0) {
        logger.info('🔄 Adding vectors to index...')
        this.vectorDb.addVectors(allChunksWithVectors)
      }

      // Get final statistics
      const finalStats = this.vectorDb.getStats()
      logger.info('🎉 Vector database rebuild completed successfully!')
      logger.info('📈 Final Statistics:')
      logger.info(`   Total vectors in index: ${finalStats.totalVectors}`)
      logger.info(`   Chunk mappings: ${finalStats.mappingsCount}`)

      if (finalStats.totalVectors !== allChunksWithVectors.length) {
        logger.warn(
          `⚠️  Warning: Expected ${allChunksWithVectors.length} vectors but index contains ${finalStats.totalVectors}`
        )
      } else {
        logger.info('✅ All vectors successfully added to index!')
      }
    } catch (error) {
      logger.error('❌ Failed to rebuild vector database:', error)
      throw error
    }
  }

  /**
   * Rebuild index for a specific document only
   */
  rebuildForDocument(documentId: string): void {
    try {
      logger.info(`🔧 Rebuilding vector index for document: ${documentId}`)

      // Get document info
      const documents = this.fileStorage.getAllDocuments()
      const document = documents.find((doc) => doc.id === documentId)

      if (!document) {
        throw new Error(`Document not found: ${documentId}`)
      }

      logger.info(`📄 Processing document: ${document.name}`)

      // Get chunks for this document
      const chunks = this.fileStorage.getChunksByDocumentId(documentId)
      const chunksWithVectors = chunks.filter(
        (chunk) => chunk.vector && chunk.vector.length > 0
      )

      logger.info(
        `📊 Document has ${chunks.length} chunks, ${chunksWithVectors.length} with vectors`
      )

      if (chunksWithVectors.length === 0) {
        logger.warn('⚠️  No chunks with vectors found for this document')
        return
      }

      // Initialize if needed
      this.vectorDb.initialize()

      // Remove existing vectors for this document
      logger.info('🗑️  Removing existing vectors for this document...')
      this.vectorDb.removeDocumentVectors(documentId)

      // Add the vectors back
      logger.info('➕ Adding updated vectors...')
      this.vectorDb.addVectors(chunksWithVectors)

      logger.info(
        `✅ Successfully rebuilt index for document: ${document.name}`
      )
    } catch (error) {
      logger.error(
        `❌ Failed to rebuild index for document ${documentId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Validate the vector database integrity
   */
  validateIndex(): boolean {
    try {
      logger.info('🔍 Validating vector database integrity...')

      this.vectorDb.initialize()
      const stats = this.vectorDb.getStats()
      const fileStats = this.getStatistics()

      console.log('\n🔍 Validation Results:')
      console.log('='.repeat(40))
      console.log(`Vectors in index: ${stats.totalVectors}`)
      console.log(`Chunk mappings: ${stats.mappingsCount}`)
      console.log(
        `Chunks with vectors in files: ${fileStats.chunksWithVectors}`
      )

      let isValid = true

      if (stats.totalVectors === 0) {
        console.log('❌ Vector database is empty')
        isValid = false
      }

      if (stats.totalVectors !== stats.mappingsCount) {
        console.log('❌ Mismatch between vectors and mappings')
        isValid = false
      }

      if (Math.abs(stats.totalVectors - fileStats.chunksWithVectors) > 0) {
        console.log(
          `❌ Mismatch: Index has ${stats.totalVectors} vectors but found ${fileStats.chunksWithVectors} chunks with vectors`
        )
        isValid = false
      }

      if (isValid) {
        console.log('✅ Vector database validation passed!')
      } else {
        console.log('❌ Vector database validation failed!')
        console.log('   Consider running a rebuild to fix issues.')
      }

      return isValid
    } catch (error) {
      logger.error('❌ Validation failed:', error)
      return false
    }
  }
}

/**
 * Main execution function
 */
function main(): void {
  const args = process.argv.slice(2)
  const command = args[0]
  const rebuilder = new VectorIndexRebuilder()

  console.log('🔧 Vector Database Rebuild Tool')
  console.log('='.repeat(50))

  switch (command) {
    case 'rebuild':
    case 'build': {
      const verbose = args.includes('--verbose') || args.includes('-v')
      rebuilder.rebuildComplete(verbose)
      break
    }

    case 'rebuild-document':
    case 'build-doc':
      if (args.length < 2) {
        console.log('❌ Error: Document ID required')
        console.log(
          'Usage: npm run rebuild-vector-db rebuild-document <documentId>'
        )
        process.exit(1)
      }
      rebuilder.rebuildForDocument(args[1])
      break

    case 'validate':
    case 'check':
      rebuilder.validateIndex()
      break

    case 'stats':
    case 'status':
      rebuilder.showStats()
      break

    case 'help':
    case '--help':
    case '-h':
    default:
      console.log('📖 Available Commands:')
      console.log('')
      console.log(
        '  rebuild                    Rebuild the entire vector database'
      )
      console.log('  rebuild --verbose          Rebuild with detailed output')
      console.log(
        '  rebuild-document <id>      Rebuild index for specific document'
      )
      console.log(
        '  validate                   Check vector database integrity'
      )
      console.log('  stats                      Show database statistics')
      console.log('  help                       Show this help message')
      console.log('')
      console.log('📝 Examples:')
      console.log('  npx tsx scripts/rebuild-vector-db.ts rebuild')
      console.log('  npx tsx scripts/rebuild-vector-db.ts stats')
      console.log('  npx tsx scripts/rebuild-vector-db.ts validate')
      console.log(
        '  npx tsx scripts/rebuild-vector-db.ts rebuild-document abc-123'
      )
      break
  }
}

// Run the script if executed directly
if (require.main === module) {
  try {
    main()
    logger.info('✅ Script completed successfully')
  } catch (error: unknown) {
    logger.error('❌ Script failed:', error)
    process.exit(1)
  }
}

export { VectorIndexRebuilder }
