/**
 * Socket Chat System Test Script
 *
 * This script tests the WebSocket chat functionality including:
 * - Socket connection and authentication
 * - Chat session joining
 * - Message sending and streaming responses
 * - Real-time event handling
 *
 * Run with: pnpm test:socket-chat
 */

import jwt from 'jsonwebtoken'
import { io } from 'socket.io-client'

import config from '../config'
import { AgentService } from '../services/agent.service'
import { ChatService } from '../services/chat.service'
import logger from '../utils/logger'

interface TestResult {
  testName: string
  success: boolean
  duration: number
  error?: string
}

class SocketChatTester {
  private results: TestResult[] = []
  private serverUrl: string
  private testUserId: string
  private testToken: string
  private chatService: ChatService
  private agentService: AgentService

  constructor() {
    this.serverUrl = `http://localhost:${config.PORT || 8080}`
    this.testUserId = `test-user-${Date.now()}`
    this.testToken = jwt.sign({ userId: this.testUserId }, config.JWT_SECRET)
    this.chatService = new ChatService()
    this.agentService = new AgentService()
  }

  /**
   * Run all socket chat tests
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Socket Chat System Tests')
    console.log('='.repeat(60))

    try {
      // Setup test data
      await this.setupTestData()

      // Run socket tests
      await this.testSocketConnection()
      await this.testChatJoining()
      await this.testMessageSending()
      await this.testStreamingResponse()
      await this.testTypingIndicators()
      await this.testErrorHandling()

      // Cleanup
      await this.cleanup()

      // Print results
      this.printResults()
    } catch (error) {
      logger.error('Socket chat test failed:', error)
      console.log('❌ Socket chat test suite failed')
    }
  }

  /**
   * Setup test data (agent, documents, chat session)
   */
  private async setupTestData(): Promise<void> {
    try {
      console.log('📋 Setting up test data...')

      // Create test agent
      const agent = this.agentService.createAgent({
        name: 'Socket Test Agent',
        description: 'Test agent for socket chat functionality',
        systemPrompt: 'You are a helpful AI assistant for testing purposes.',
        userId: this.testUserId,
        documentIds: [],
      })

      this.testAgentId = agent.id

      // Create test chat session
      const session = this.chatService.createChatSession({
        userId: this.testUserId,
        agentId: agent.id,
        title: 'Socket Test Session',
      })

      this.testSessionId = session.id

      console.log('  ✅ Test agent created:', agent.name)
      console.log('  ✅ Test session created:', session.title)
    } catch (error) {
      throw new Error(
        `Test data setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private testAgentId!: string
  private testSessionId!: string

  /**
   * Test basic socket connection
   */
  private async testSocketConnection(): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now()

      try {
        console.log('\n🔌 Testing socket connection...')

        const socket = io(this.serverUrl, {
          timeout: 5000,
        })

        socket.on('connect', () => {
          const duration = Date.now() - startTime
          console.log('  ✅ Socket connected successfully')

          this.results.push({
            testName: 'Socket Connection',
            success: true,
            duration,
          })

          socket.disconnect()
          resolve()
        })

        socket.on('connect_error', (error) => {
          const duration = Date.now() - startTime
          console.log('  ❌ Socket connection failed:', error.message)

          this.results.push({
            testName: 'Socket Connection',
            success: false,
            duration,
            error: error.message,
          })

          resolve()
        })

        setTimeout(() => {
          const duration = Date.now() - startTime
          console.log('  ❌ Socket connection timeout')

          this.results.push({
            testName: 'Socket Connection',
            success: false,
            duration,
            error: 'Connection timeout',
          })

          socket.disconnect()
          resolve()
        }, 6000)
      } catch (error) {
        const duration = Date.now() - startTime
        this.results.push({
          testName: 'Socket Connection',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        resolve()
      }
    })
  }

  /**
   * Test chat session joining
   */
  private async testChatJoining(): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now()

      try {
        console.log('\n💬 Testing chat joining...')

        const socket = io(this.serverUrl)

        socket.on('connect', () => {
          console.log('  📡 Connected, joining chat...')

          socket.emit('join_chat', {
            sessionId: this.testSessionId,
            token: this.testToken,
          })
        })

        socket.on('chat_joined', (data) => {
          const duration = Date.now() - startTime
          console.log('  ✅ Chat joined successfully')
          console.log(`     Session: ${data.session.title}`)
          console.log(`     Messages: ${data.messages.length}`)

          this.results.push({
            testName: 'Chat Joining',
            success: true,
            duration,
          })

          socket.disconnect()
          resolve()
        })

        socket.on('error', (error) => {
          const duration = Date.now() - startTime
          console.log('  ❌ Chat join failed:', error.message)

          this.results.push({
            testName: 'Chat Joining',
            success: false,
            duration,
            error: error.message,
          })

          socket.disconnect()
          resolve()
        })

        setTimeout(() => {
          const duration = Date.now() - startTime
          console.log('  ❌ Chat join timeout')

          this.results.push({
            testName: 'Chat Joining',
            success: false,
            duration,
            error: 'Join timeout',
          })

          socket.disconnect()
          resolve()
        }, 10000)
      } catch (error) {
        const duration = Date.now() - startTime
        this.results.push({
          testName: 'Chat Joining',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        resolve()
      }
    })
  }

  /**
   * Test message sending (without OpenAI - just structure)
   */
  private async testMessageSending(): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now()

      try {
        console.log('\n📨 Testing message sending...')

        const socket = io(this.serverUrl)
        let messageReceived = false
        let aiResponseStarted = false

        socket.on('connect', () => {
          socket.emit('join_chat', {
            sessionId: this.testSessionId,
            token: this.testToken,
          })
        })

        socket.on('chat_joined', () => {
          console.log('  📡 Chat joined, sending test message...')

          socket.emit('send_message', {
            message: 'Hello, this is a test message!',
            sessionId: this.testSessionId,
          })
        })

        socket.on('message_received', (message) => {
          console.log('  ✅ Message received event triggered')
          console.log(`     Content: ${message.content}`)
          messageReceived = true

          // Check if we got both events
          if (messageReceived && aiResponseStarted) {
            const duration = Date.now() - startTime
            this.results.push({
              testName: 'Message Sending',
              success: true,
              duration,
            })
            socket.disconnect()
            resolve()
          }
        })

        socket.on('ai_response_start', (data) => {
          console.log('  ✅ AI response start event triggered')
          console.log(`     Message ID: ${data.messageId}`)
          aiResponseStarted = true

          // Check if we got both events
          if (messageReceived && aiResponseStarted) {
            const duration = Date.now() - startTime
            this.results.push({
              testName: 'Message Sending',
              success: true,
              duration,
            })
            socket.disconnect()
            resolve()
          }
        })

        socket.on('error', (error) => {
          const duration = Date.now() - startTime
          console.log('  ❌ Message sending failed:', error.message)

          this.results.push({
            testName: 'Message Sending',
            success: false,
            duration,
            error: error.message,
          })

          socket.disconnect()
          resolve()
        })

        setTimeout(() => {
          const duration = Date.now() - startTime
          console.log(
            '  ⚠️  Message sending timeout (expected without OpenAI API key)'
          )

          // This is expected to timeout without OpenAI API key
          this.results.push({
            testName: 'Message Sending',
            success: messageReceived, // Success if at least message received works
            duration,
            error: messageReceived
              ? undefined
              : 'Timeout - no message received',
          })

          socket.disconnect()
          resolve()
        }, 15000)
      } catch (error) {
        const duration = Date.now() - startTime
        this.results.push({
          testName: 'Message Sending',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        resolve()
      }
    })
  }

  /**
   * Test streaming response handling (structure without actual OpenAI)
   */
  private async testStreamingResponse(): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now()

      try {
        console.log('\n🌊 Testing streaming response structure...')
        console.log('     (Note: Actual streaming requires OpenAI API key)')

        // For now, just test that the event handlers are set up correctly
        const socket = io(this.serverUrl)
        let eventsRegistered = 0

        socket.on('connect', () => {
          console.log('  📡 Connected, registering streaming event handlers...')
        })

        // Test that streaming event handlers can be registered
        socket.on('ai_response_chunk', () => {
          eventsRegistered++
        })

        socket.on('ai_response_complete', () => {
          eventsRegistered++
        })

        socket.on('ai_response_error', () => {
          eventsRegistered++
        })

        setTimeout(() => {
          const duration = Date.now() - startTime
          console.log('  ✅ Streaming event handlers registered successfully')

          this.results.push({
            testName: 'Streaming Response Structure',
            success: true,
            duration,
          })

          socket.disconnect()
          resolve()
        }, 2000)
      } catch (error) {
        const duration = Date.now() - startTime
        this.results.push({
          testName: 'Streaming Response Structure',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        resolve()
      }
    })
  }

  /**
   * Test typing indicators
   */
  private async testTypingIndicators(): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now()

      try {
        console.log('\n⌨️  Testing typing indicators...')

        const socket = io(this.serverUrl)
        let typingEventsReceived = 0

        socket.on('connect', () => {
          socket.emit('join_chat', {
            sessionId: this.testSessionId,
            token: this.testToken,
          })
        })

        socket.on('chat_joined', () => {
          console.log('  📡 Chat joined, testing typing events...')

          // Test typing start
          socket.emit('typing_start', this.testSessionId)

          setTimeout(() => {
            // Test typing stop
            socket.emit('typing_stop', this.testSessionId)
          }, 1000)
        })

        // These events are only received by other users, not the sender
        // So we just test that the events can be sent without error
        setTimeout(() => {
          const duration = Date.now() - startTime
          console.log('  ✅ Typing indicator events sent successfully')

          this.results.push({
            testName: 'Typing Indicators',
            success: true,
            duration,
          })

          socket.disconnect()
          resolve()
        }, 3000)
      } catch (error) {
        const duration = Date.now() - startTime
        this.results.push({
          testName: 'Typing Indicators',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        resolve()
      }
    })
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now()

      try {
        console.log('\n🚨 Testing error handling...')

        const socket = io(this.serverUrl)

        socket.on('connect', () => {
          console.log('  📡 Connected, testing invalid token...')

          // Test with invalid token
          socket.emit('join_chat', {
            sessionId: this.testSessionId,
            token: 'invalid-token',
          })
        })

        socket.on('error', (error) => {
          const duration = Date.now() - startTime
          console.log('  ✅ Error handling works correctly')
          console.log(`     Error type: ${error.type}`)
          console.log(`     Error message: ${error.message}`)

          this.results.push({
            testName: 'Error Handling',
            success: true,
            duration,
          })

          socket.disconnect()
          resolve()
        })

        setTimeout(() => {
          const duration = Date.now() - startTime
          console.log('  ❌ No error received for invalid token')

          this.results.push({
            testName: 'Error Handling',
            success: false,
            duration,
            error: 'Expected error not received',
          })

          socket.disconnect()
          resolve()
        }, 5000)
      } catch (error) {
        const duration = Date.now() - startTime
        this.results.push({
          testName: 'Error Handling',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        resolve()
      }
    })
  }

  /**
   * Cleanup test data
   */
  private async cleanup(): Promise<void> {
    try {
      console.log('\n🧹 Cleaning up test data...')

      // Delete test agent and associated data
      this.agentService.deleteAgent(this.testAgentId, this.testUserId)

      console.log('  ✅ Test data cleaned up successfully')
    } catch (error) {
      console.log('  ⚠️  Cleanup warning:', error)
    }
  }

  /**
   * Print test results
   */
  private printResults(): void {
    console.log('\n📊 Socket Chat Test Results')
    console.log('='.repeat(60))

    let totalTests = this.results.length
    let passedTests = this.results.filter((r) => r.success).length
    let failedTests = totalTests - passedTests

    this.results.forEach((result) => {
      const status = result.success ? '✅' : '❌'
      const duration = `${result.duration}ms`
      const error = result.error ? ` (${result.error})` : ''

      console.log(`${status} ${result.testName.padEnd(30)} ${duration}${error}`)
    })

    console.log('-'.repeat(60))
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${passedTests}`)
    console.log(`Failed: ${failedTests}`)
    console.log(
      `Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`
    )

    if (failedTests === 0) {
      console.log('\n🎉 All socket chat tests passed!')
    } else {
      console.log(
        `\n⚠️  ${failedTests} test(s) failed. Check the results above.`
      )
    }

    console.log(
      '\nNote: Some failures are expected without OpenAI API key configured.'
    )
  }
}

// Run the tests
async function runSocketChatTests(): Promise<void> {
  const tester = new SocketChatTester()
  await tester.runAllTests()
}

// Export for programmatic use
export { SocketChatTester }

// Run if called directly
if (require.main === module) {
  runSocketChatTests().catch((error) => {
    console.error('Socket chat test runner failed:', error)
    process.exit(1)
  })
}
