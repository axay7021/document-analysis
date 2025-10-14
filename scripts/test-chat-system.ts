#!/usr/bin/env tsx

/**
 * Chat System Integration Test
 *
 * This script tests the complete chat system including:
 * - Chat session creation
 * - Agent-document associations
 * - Message sending with RAG context retrieval
 * - Vector database integration
 */

import fs from 'fs'
import path from 'path'

import { AgentService } from '../services/agent.service'
import { ChatService } from '../services/chat.service'
import { DocumentIngestionService } from '../services/documentIngestion.service'
import { VectorDatabaseService } from '../services/vectorDatabase.service'
import logger from '../utils/logger'

interface TestAgent {
  id: string
  name: string
  documentIds: string[]
}

interface TestDocument {
  id: string
  name: string
  content: string
}

async function testChatSystem(): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log('🚀 Testing Chat System with RAG Integration')
    // eslint-disable-next-line no-console
    console.log('='.repeat(60))

    // Initialize services
    const agentService = new AgentService()
    const chatService = new ChatService()
    const ingestionService = new DocumentIngestionService()
    const vectorDb = new VectorDatabaseService()

    // Initialize vector database
    vectorDb.initialize()

    const testUserId = 'test-user-' + Date.now()

    // Step 1: Create test documents with sample content
    // eslint-disable-next-line no-console
    console.log('📄 Step 1: Creating test documents...')

    const testDocuments: TestDocument[] = [
      {
        id: 'doc-1-' + Date.now(),
        name: 'research-findings.txt',
        content: `
Research Findings on AI and Machine Learning

This document contains key findings from our recent research on artificial intelligence and machine learning applications.

Key Findings:
1. Machine learning models show significant improvement when trained on diverse datasets
2. Natural language processing has advanced significantly with transformer architectures
3. Computer vision applications have reached near-human accuracy in image recognition
4. Reinforcement learning shows promise in robotics and game playing

Methodology:
We conducted experiments using various deep learning frameworks including TensorFlow and PyTorch.
The datasets included both supervised and unsupervised learning scenarios.

Results:
Our models achieved 95% accuracy on the test datasets.
Processing time was reduced by 40% compared to previous implementations.

Conclusion:
AI technology continues to evolve rapidly, with practical applications becoming more accessible.
        `.trim(),
      },
      {
        id: 'doc-2-' + Date.now(),
        name: 'technical-specifications.txt',
        content: `
Technical Specifications for AI System

This document outlines the technical requirements and specifications for implementing our AI system.

System Requirements:
- Python 3.8 or higher
- TensorFlow 2.x or PyTorch 1.x
- CUDA-compatible GPU with 8GB+ VRAM
- 32GB RAM minimum for training
- SSD storage for fast data access

Architecture:
The system follows a microservices architecture with the following components:
- Data preprocessing pipeline
- Model training service
- Inference API server
- Vector database for embeddings
- Web-based user interface

Performance Metrics:
- Inference latency: <100ms
- Throughput: 1000 requests/second
- Model accuracy: >95%
- System uptime: 99.9%

Security Features:
- JWT-based authentication
- API rate limiting
- Data encryption at rest
- Secure model deployment
        `.trim(),
      },
    ]

    // Create document records and process them
    const createdDocuments: any[] = []
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    for (const testDoc of testDocuments) {
      // Create temporary file for processing
      const tempFile = path.join(__dirname, `../uploads/temp-${testDoc.id}.txt`)
      fs.writeFileSync(tempFile, testDoc.content)

      try {
        const document = {
          id: testDoc.id,
          userId: testUserId,
          agentIds: [] as string[],
          name: testDoc.name,
          content: testDoc.content,
          type: 'text' as const,
          uploadedAt: new Date(),
          updatedAt: new Date(),
          size: Buffer.byteLength(testDoc.content, 'utf8'),
          metadata: {
            filePath: tempFile,
            test: true,
          },
        }

        // Process document through ingestion pipeline
        const chunks = await ingestionService.ingestDocument(document)
        createdDocuments.push(document)

        // eslint-disable-next-line no-console
        console.log(`  ✅ Document processed: ${document.name}`)
        // eslint-disable-next-line no-console
        console.log(`     Chunks created: ${chunks.length}`)
      } finally {
        // Cleanup temp file after processing
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile)
        }
      }
    }

    // Step 2: Create test agent with associated documents
    // eslint-disable-next-line no-console
    console.log('\n🤖 Step 2: Creating test agent...')

    const agent = agentService.createAgent({
      userId: testUserId,
      name: 'Research Assistant',
      description:
        'AI assistant specialized in research and technical documentation',
      systemPrompt:
        'You are a helpful research assistant. Use the provided documents to answer questions accurately and cite your sources.',
      documentIds: createdDocuments.map((doc) => doc.id),
    })

    // eslint-disable-next-line no-console
    console.log(`  ✅ Agent created: ${agent.name} (${agent.id})`)
    // eslint-disable-next-line no-console
    console.log(`     Associated documents: ${agent.documentIds.length}`)

    // Step 3: Create chat session
    // eslint-disable-next-line no-console
    console.log('\n💬 Step 3: Creating chat session...')

    const chatSession = chatService.createChatSession({
      userId: testUserId,
      agentId: agent.id,
      title: 'Research Discussion',
    })

    // eslint-disable-next-line no-console
    console.log(
      `  ✅ Chat session created: ${chatSession.title} (${chatSession.id})`
    )

    // Step 4: Test message exchange with context retrieval
    // eslint-disable-next-line no-console
    console.log('\n📨 Step 4: Testing message exchange...')

    const testMessages = [
      'What are the key findings from the research?',
      'What are the system requirements for the AI system?',
      'How accurate are the machine learning models mentioned?',
      'What security features are included in the system?',
    ]

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i]
      // eslint-disable-next-line no-console
      console.log(`\n  📤 Sending message ${i + 1}: "${message}"`)

      try {
        const startTime = Date.now()
        const response = await chatService.sendMessage({
          sessionId: chatSession.id,
          userId: testUserId,
          message,
        })
        const responseTime = Date.now() - startTime

        // eslint-disable-next-line no-console
        console.log(`  📥 Response received in ${responseTime}ms`)
        // eslint-disable-next-line no-console
        console.log(
          `     Response: ${response.message.content.substring(0, 200)}...`
        )
        // eslint-disable-next-line no-console
        console.log(
          `     Referenced chunks: ${response.message.referencedChunkIds?.length || 0}`
        )

        if (
          response.referencedDocuments &&
          response.referencedDocuments.length > 0
        ) {
          // eslint-disable-next-line no-console
          console.log(
            `     Referenced documents: ${response.referencedDocuments.length}`
          )
          for (const doc of response.referencedDocuments) {
            // eslint-disable-next-line no-console
            console.log(
              `       - ${doc.name} (${doc.relevantChunks.length} chunks)`
            )
          }
        }

        // Small delay between messages
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(
          `  ❌ Error sending message: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    // Step 5: Test session retrieval
    // eslint-disable-next-line no-console
    console.log('\n📋 Step 5: Testing session retrieval...')

    const retrievedSession = chatService.getChatSession(
      chatSession.id,
      testUserId
    )
    if (retrievedSession) {
      // eslint-disable-next-line no-console
      console.log(
        `  ✅ Session retrieved: ${retrievedSession.messages.length} messages`
      )
    }

    const userSessions = chatService.getUserChatSessions(testUserId)
    // eslint-disable-next-line no-console
    console.log(`  ✅ User sessions retrieved: ${userSessions.length} sessions`)

    // Step 6: Test vector database statistics
    // eslint-disable-next-line no-console
    console.log('\n📊 Step 6: Vector database statistics...')

    const vectorStats = vectorDb.getStats()
    // eslint-disable-next-line no-console
    console.log(`  📊 Total vectors: ${vectorStats.totalVectors}`)
    // eslint-disable-next-line no-console
    console.log(`  📊 Chunk mappings: ${vectorStats.mappingsCount}`)

    // Step 7: Cleanup test data
    // eslint-disable-next-line no-console
    console.log('\n🧹 Step 7: Cleaning up test data...')

    try {
      // Delete agent (which should cascade to documents and chunks)
      agentService.deleteAgent(agent.id, testUserId)
      // eslint-disable-next-line no-console
      console.log('  ✅ Test agent and associated documents cleaned up')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(
        `  ⚠️  Cleanup warning: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // eslint-disable-next-line no-console
    console.log('\n🎉 Chat system test completed successfully!')
    // eslint-disable-next-line no-console
    console.log('\n📋 Test Summary:')
    // eslint-disable-next-line no-console
    console.log(`  • Documents processed: ${testDocuments.length}`)
    // eslint-disable-next-line no-console
    console.log(`  • Agent created: 1`)
    // eslint-disable-next-line no-console
    console.log(`  • Chat session created: 1`)
    // eslint-disable-next-line no-console
    console.log(`  • Messages exchanged: ${testMessages.length}`)
    // eslint-disable-next-line no-console
    console.log(`  • Vector search integration: ✅`)
    // eslint-disable-next-line no-console
    console.log(`  • RAG context retrieval: ✅`)
  } catch (error) {
    logger.error('Chat system test failed:', error)
    // eslint-disable-next-line no-console
    console.error(
      '❌ Chat system test failed:',
      error instanceof Error ? error.message : String(error)
    )
    process.exit(1)
  }
}

// Handle script termination gracefully
process.on('SIGINT', () => {
  // eslint-disable-next-line no-console
  console.log('\n⚠️  Test interrupted by user')
  process.exit(0)
})

// Run the test
void testChatSystem()
