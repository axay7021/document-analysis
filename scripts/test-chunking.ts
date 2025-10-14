#!/usr/bin/env tsx

/**
 * Test Document Chunking and Vector Database Integration
 *
 * This script demonstrates the complete document processing pipeline
 * including chunking and vector database storage.
 */

import fs from 'fs'
import { DocumentIngestionService } from '../services/documentIngestion.service'
import { VectorDatabaseService } from '../services/vectorDatabase.service'
import logger from '../utils/logger'

async function testDocumentProcessing(): Promise<void> {
  try {
    console.log('🚀 Testing Document Chunking and Vector Database Integration')
    console.log('='.repeat(60))

    // Initialize services
    const ingestionService = new DocumentIngestionService()
    const vectorDb = new VectorDatabaseService()

    // Initialize vector database
    vectorDb.initialize()

    // Create a test document
    const testDocument = {
      id: 'test-doc-' + Date.now(),
      userId: 'test-user',
      agentIds: ['test-agent'],
      name: 'test-document.txt',
      content: '', // Will be filled by processing
      type: 'text' as const,
      uploadedAt: new Date(),
      updatedAt: new Date(),
      size: 0,
      metadata: {
        filePath: './test-data/sample-document.txt',
      },
    }

    // Check if test file exists
    if (!fs.existsSync(testDocument.metadata.filePath as string)) {
      console.log('📝 Creating test document...')
      const testContent = `
This is a comprehensive test document for demonstrating the document chunking and vector database integration system.

The document processing pipeline includes several key stages:

1. Text Extraction: The system can extract text from various file formats including PDF and plain text files. 
   The extraction process handles different encodings and formats to ensure accurate content retrieval.

2. Text Chunking: Once text is extracted, it is divided into manageable chunks using smart algorithms.
   The chunking process considers sentence boundaries and maintains context through overlapping segments.
   This ensures that related information stays together while creating searchable units.

3. Embedding Generation: Each chunk is processed through an embedding model to create vector representations.
   These vectors capture the semantic meaning of the text content, enabling similarity searches.

4. Vector Database Storage: The generated embeddings are stored in a FAISS vector database for efficient retrieval.
   The system maintains mappings between vector indices and chunk identifiers for accurate results.

5. Search and Retrieval: Users can perform semantic searches to find relevant document segments.
   The vector database enables fast similarity comparisons and ranking of results.

This integrated approach provides a robust foundation for document analysis, knowledge management, and retrieval-augmented generation systems.
The system is designed to handle large document collections while maintaining performance and accuracy.

Additional features include automatic cleanup of orphaned documents, efficient batch processing, and comprehensive error handling throughout the pipeline.
      `.trim()

      fs.writeFileSync(testDocument.metadata.filePath as string, testContent)
      testDocument.size = Buffer.byteLength(testContent, 'utf8')
    }

    console.log(`📄 Processing document: ${testDocument.name}`)
    console.log(`📊 Document size: ${testDocument.size} bytes`)

    // Process the document through the complete pipeline
    const startTime = Date.now()
    const chunks = await ingestionService.ingestDocument(testDocument)
    const processingTime = Date.now() - startTime

    console.log('✅ Document processing completed!')
    console.log(`⏱️  Processing time: ${processingTime}ms`)
    console.log(`🔢 Chunks created: ${chunks.length}`)
    console.log(
      `📝 Average chunk size: ${Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length)} characters`
    )

    // Display chunk information
    console.log('\n📋 Chunk Details:')
    console.log('-'.repeat(40))
    chunks.forEach((chunk, index) => {
      const hasVector = chunk.vector && chunk.vector.length > 0
      console.log(`Chunk ${index + 1}: ${chunk.content.substring(0, 100)}...`)
      console.log(`  - ID: ${chunk.id}`)
      console.log(`  - Size: ${chunk.content.length} chars`)
      console.log(`  - Position: ${chunk.startPosition}-${chunk.endPosition}`)
      console.log(`  - Has Vector: ${hasVector ? '✅' : '❌'}`)
      console.log()
    })

    // Test vector database statistics
    const stats = vectorDb.getStats()
    console.log('📊 Vector Database Statistics:')
    console.log(`  - Total Vectors: ${stats.totalVectors}`)
    console.log(`  - Chunk Mappings: ${stats.mappingsCount}`)

    // Test vector search (if embeddings were generated)
    if (chunks[0].vector && chunks[0].vector.length > 0) {
      console.log('\n🔍 Testing Vector Search...')
      const searchResults = vectorDb.searchSimilar(chunks[0].vector, 3, 0.1)
      console.log(`Found ${searchResults.length} similar chunks`)

      searchResults.forEach((result, index) => {
        console.log(
          `  Result ${index + 1}: Score ${result.score.toFixed(4)}, Chunk ${result.chunkId}`
        )
      })
    }

    // Test cleanup
    console.log('\n🧹 Testing document cleanup...')
    ingestionService.deleteDocumentChunks(testDocument.id)
    console.log('✅ Cleanup completed')

    const finalStats = vectorDb.getStats()
    console.log(`📊 Final Vector Count: ${finalStats.totalVectors}`)

    console.log('\n🎉 All tests completed successfully!')
  } catch (error) {
    logger.error('Test failed:', error)
    console.error(
      '❌ Test failed:',
      error instanceof Error ? error.message : String(error)
    )
    process.exit(1)
  }
}

// Handle script termination gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️  Test interrupted by user')
  process.exit(0)
})

// Run the test
void testDocumentProcessing()
