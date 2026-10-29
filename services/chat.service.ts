import { v4 as uuidv4 } from 'uuid'

import { ChatSessionModel, ChunkModel } from '../models'
import type {
  Agent,
  ChatMessage,
  ChatSession,
  Document,
  RAGResponse,
} from '../types/types'
import logger from '../utils/logger'
import { AgentService } from './agent.service'
import { RAGService } from './rag.service'

export interface CreateChatSessionRequest {
  userId: string
  agentId?: string // Now optional - agents can be tagged per message instead
  title?: string
}

export interface ChatMessageRequest {
  sessionId: string
  userId: string
  message: string
  agentId?: string // Optional agent ID for agent tagging in messages
}

export interface ChatResponse {
  message: ChatMessage
  session: ChatSession
  referencedDocuments?: Array<{
    id: string
    name: string
    relevantChunks: Array<{
      id: string
      content: string
      score: number
    }>
  }>
}

export class ChatService {
  private agentService: AgentService
  private ragService: RAGService

  constructor() {
    this.agentService = new AgentService()
    this.ragService = new RAGService()

    // Initialize RAG service
    try {
      this.ragService.initialize()
    } catch (error) {
      logger.warn('Failed to initialize RAG service:', error)
      // RAG service initialization failure doesn't prevent chat service from working
    }
  }

  /**
   * Create a new chat session (optionally with a default agent)
   */
  createChatSession(request: CreateChatSessionRequest): ChatSession {
    try {
      let agent = null
      let sessionTitle = request.title || 'New Chat Session'

      // If agent is specified, validate it exists and belongs to user
      if (request.agentId) {
        agent = this.agentService.getAgentById(request.agentId, request.userId)
        if (!agent) {
          throw new Error('Agent not found or access denied')
        }
        sessionTitle = request.title || `Chat with ${agent.name}`
      }

      const sessionData: Omit<ChatSession, 'id'> = {
        userId: request.userId,
        agentId: request.agentId || undefined, // Allow undefined for sessions without default agent
        title: sessionTitle,
        messages: [],
        documentIds: [], // Initialize empty document IDs array
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      }

      const session = ChatSessionModel.create(sessionData)
      logger.info(
        `Chat session created: ${session.id}${agent ? ` for agent: ${agent.name}` : ' (no default agent)'}`
      )
      return session
    } catch (error) {
      logger.error('Error creating chat session:', error)
      throw new Error('Failed to create chat session')
    }
  }

  /**
   * Get chat sessions for a user
   */
  getUserChatSessions(userId: string): ChatSession[] {
    try {
      const allSessions = ChatSessionModel.find({})
      logger.info(
        `Found ${allSessions.length} total sessions, filtering for user: ${userId}`
      )

      const userSessions = allSessions.filter(
        (session) => session.userId === userId && session.isActive
      )

      logger.info(
        `Found ${userSessions.length} active sessions for user ${userId}`
      )
      return userSessions
    } catch (error) {
      logger.error('Error fetching user chat sessions:', error)
      throw new Error('Failed to fetch chat sessions')
    }
  }

  /**
   * Get or create a default chat session for user
   */
  getOrCreateDefaultChatSession(userId: string): ChatSession {
    try {
      // First, try to find existing active sessions
      const existingSessions = this.getUserChatSessions(userId)

      if (existingSessions.length > 0) {
        // Return the most recent session
        const mostRecent = existingSessions.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0]
        logger.info(`Returning existing session: ${mostRecent.id}`)
        return mostRecent
      }

      // No existing sessions, create a new one
      logger.info(
        `No existing sessions found for user ${userId}, creating new session`
      )
      const newSession = this.createChatSession({
        userId,
        title: 'Default Chat Session',
        // No agentId - will use agent tagging
      })

      logger.info(`Created new default session: ${newSession.id}`)
      return newSession
    } catch (error) {
      logger.error('Error getting or creating default chat session:', error)
      throw new Error('Failed to get or create chat session')
    }
  }

  /**
   * Find agent by name (proxy method for agent tagging)
   */
  getAgentByName(agentName: string, userId: string): Agent | null {
    return this.agentService.getAgentByName(agentName, userId)
  }

  /**
   * Get specific chat session
   */
  getChatSession(sessionId: string, userId: string): ChatSession | null {
    try {
      const session = ChatSessionModel.findOne({ id: sessionId })

      if (!session || session.userId !== userId) {
        return null
      }

      return session
    } catch (error) {
      logger.error('Error fetching chat session:', error)
      throw new Error('Failed to fetch chat session')
    }
  }

  /**
   * Send a message in a chat session and get AI response
   */
  async sendMessage(request: ChatMessageRequest): Promise<ChatResponse> {
    try {
      // Get chat session and validate access
      const session = this.getChatSession(request.sessionId, request.userId)
      if (!session) {
        throw new Error('Chat session not found or access denied')
      }

      // Get agent context - use tagged agent from message or session agent
      const targetAgentId = request.agentId || session.agentId

      if (!targetAgentId) {
        throw new Error(
          'No agent specified. Please tag an agent using @agentName or select a default agent for this session.'
        )
      }

      const agentContext = this.agentService.getAgentContext(
        targetAgentId,
        request.userId
      )

      if (!agentContext) {
        throw new Error(
          `Agent not found or access denied for agent ID: ${targetAgentId}`
        )
      }

      // Create user message
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: request.message,
        timestamp: new Date(),
      }

      // Generate AI response using RAG with agent context
      const aiResponse = await this.generateAIResponse(
        request.message,
        agentContext.agent,
        agentContext.documents,
        session.messages
      )

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: aiResponse.answer,
        timestamp: new Date(),
        referencedChunkIds: aiResponse.referencedChunks.map(
          (chunk) => chunk.chunkId
        ),
      }

      // Update session with new messages
      const updatedMessages = [
        ...session.messages,
        userMessage,
        assistantMessage,
      ]

      // Generate session title if this is the first message or if session has default title
      let sessionTitle = session.title
      if (
        session.messages.length === 0 || // First user message
        session.title === 'New Chat Session' ||
        session.title === 'Default Chat Session' ||
        session.title.startsWith('Chat with')
      ) {
        sessionTitle = await this.generateSessionTitle(
          request.message,
          aiResponse.answer
        )
        logger.info(`Generated session title: "${sessionTitle}"`)
      }

      const updatedSession = ChatSessionModel.save({
        ...session,
        title: sessionTitle,
        messages: updatedMessages,
        updatedAt: new Date(),
      })

      // The save method always returns a truthy value, so this check is unnecessary and removed.

      // Prepare response with referenced documents
      const referencedDocuments = this.prepareReferencedDocuments(
        aiResponse.referencedChunks,
        agentContext.documents
      )

      return {
        message: assistantMessage,
        session: updatedSession,
        referencedDocuments,
      }
    } catch (error) {
      logger.error('Error sending chat message:', error)
      throw new Error('Failed to send message')
    }
  }

  /**
   * Generate AI response using RAG with agent-specific context
   */
  private async generateAIResponse(
    userMessage: string,
    agent: Agent,
    documents: Document[],
    chatHistory: ChatMessage[]
  ): Promise<RAGResponse> {
    try {
      // Build custom system prompt that includes agent context
      const systemPromptParts = []

      // Add agent role and instructions
      systemPromptParts.push(`Role: ${agent.role}`)
      systemPromptParts.push(`Instructions: ${agent.systemPrompt}`)

      // Add conversation context
      if (chatHistory.length > 0) {
        systemPromptParts.push('\nConversation Context:')
        const recentMessages = chatHistory.slice(-4) // Last 4 messages for context
        recentMessages.forEach((msg) => {
          systemPromptParts.push(
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
          )
        })
      }

      systemPromptParts.push(
        "\nUse the provided context to answer the user's question accurately and helpfully, staying in character as defined by your role."
      )

      const customSystemPrompt = systemPromptParts.join('\n\n')

      // Get document IDs for RAG
      const documentIds = documents.map((doc) => doc.id)

      // Use RAG service with custom system prompt and agent context
      const ragResponse = await this.ragService.generateResponse({
        message: userMessage,
        docIds: documentIds,
        customSystemPrompt,
        retrievalConfig: {
          maxChunks: agent.config?.maxTokens
            ? Math.min(5, Math.floor(agent.config.maxTokens / 400))
            : 5,
          minScore: 0.6,
        },
      })

      return ragResponse
    } catch (error) {
      logger.error('Error generating AI response:', error)
      throw new Error('Failed to generate AI response')
    }
  }

  /**
   * Send message with streaming AI response
   */
  async sendMessageWithStreaming(
    request: ChatMessageRequest,
    onChunk: (chunk: {
      type: 'chunk' | 'complete' | 'error' | 'message'
      content: string
      messageId?: string
      sources?: Array<{
        documentId: string
        documentName: string
        chunkId: string
        relevanceScore: number
      }>
    }) => void
  ): Promise<ChatResponse> {
    try {
      // Get chat session
      const session = this.getChatSession(request.sessionId, request.userId)
      if (!session) {
        throw new Error('Chat session not found or access denied')
      }

      // Get agent context - use tagged agent from message or fallback to session agent
      const targetAgentId = request.agentId || session.agentId
      let agentContext = null

      if (targetAgentId) {
        agentContext = this.agentService.getAgentContext(
          targetAgentId,
          request.userId
        )


        if (!agentContext) {
          throw new Error(
            `Agent not found or access denied for agent ID: ${targetAgentId}`
          )
        }
      } else {
        // No agent specified - try to get user's first available agent as fallback
        const userAgents = this.agentService.getAgentsByUserId(request.userId)
        if (userAgents.length > 0) {
          agentContext = this.agentService.getAgentContext(
            userAgents[0].id,
            request.userId
          )
          logger.info(
            `Using fallback agent: ${userAgents[0].name} (${userAgents[0].id})`
          )
        } else {
          logger.info('No agents available - proceeding with basic chat mode')
        }
      }

      // Create user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        content: request.message,
        role: 'user',
        timestamp: new Date(),
      }

      // Add user message to session
      const updatedMessages = [...session.messages, userMessage]

      // Save session with user message immediately
      const currentSession = ChatSessionModel.save({
        ...session,
        messages: updatedMessages,
        updatedAt: new Date(),
      })

      // Generate streaming AI response
      const messageId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      let fullAIResponse = ''

      let aiResponse: {
        referencedChunks?: Array<{
          chunkId: string
          score: number
          content: string
        }>
      } | null = null
      let referencedDocuments: Array<{
        id: string
        name: string
        relevantChunks: Array<{ id: string; content: string; score: number }>
      }> = []

      if (agentContext) {
        // Agent-based chat with RAG
        aiResponse = await this.generateStreamingAIResponse(
          request.message,
          agentContext.agent,
          agentContext.documents,
          currentSession.messages,
          (chunk) => {
            // Accumulate the full response
            if (chunk.type === 'chunk' || chunk.type === 'message') {
              fullAIResponse += chunk.content
            }

            // Forward chunk to socket callback with messageId
            onChunk({
              ...chunk,
              messageId: messageId,
            })
          }
        )

        // Prepare referenced documents
        referencedDocuments = this.prepareReferencedDocuments(
          aiResponse.referencedChunks || [],
          agentContext.documents
        )
      } else {
        // Basic chat mode without agent/RAG
        await this.generateBasicStreamingResponse(
          request.message,
          currentSession.messages,
          (chunk) => {
            // Accumulate the full response
            if (chunk.type === 'chunk' || chunk.type === 'message') {
              fullAIResponse += chunk.content
            }

            // Forward chunk to socket callback with messageId
            onChunk({
              ...chunk,
              messageId: messageId,
            })
          }
        )
      }

      // Create assistant message with full response
      const assistantMessage: ChatMessage = {
        id: messageId,
        content: fullAIResponse,
        role: 'assistant',
        timestamp: new Date(),
      }

      // Add assistant message to session
      const finalMessages = [...updatedMessages, assistantMessage]

      // Generate session title if this is the first message or if session has default title
      let sessionTitle = currentSession.title
      if (
        currentSession.messages.length <= 1 || // First user message
        currentSession.title === 'New Chat Session' ||
        currentSession.title === 'Default Chat Session' ||
        currentSession.title.startsWith('Chat with')
      ) {
        sessionTitle = await this.generateSessionTitle(
          request.message,
          fullAIResponse
        )
        logger.info(`Generated session title: "${sessionTitle}"`)
      }

      const finalSession = ChatSessionModel.save({
        ...currentSession,
        title: sessionTitle,
        messages: finalMessages,
        updatedAt: new Date(),
      })

      return {
        message: assistantMessage,
        session: finalSession,
        referencedDocuments,
      }
    } catch (error) {
      logger.error('Error sending streaming message:', error)

      // Send error through callback
      onChunk({
        type: 'error',
        content: 'Failed to generate response',
      })

      throw new Error('Failed to send message')
    }
  }

  /**
   * Generate streaming AI response using RAG
   */
  private async generateStreamingAIResponse(
    userMessage: string,
    agent: Agent,
    documents: Document[],
    chatHistory: ChatMessage[],
    onChunk: (chunk: {
      type: 'chunk' | 'complete' | 'error' | 'message'
      content: string
      sources?: Array<{
        documentId: string
        documentName: string
        chunkId: string
        relevanceScore: number
      }>
    }) => void
  ): Promise<RAGResponse> {
    try {
      // Build custom system prompt that includes agent context
      const systemPromptParts = []

      // Add agent role and instructions
      // systemPromptParts.push(`Role: ${agent.role}`)
      systemPromptParts.push(`Instructions: ${agent.systemPrompt}`)

      // Add conversation context
      if (chatHistory.length > 0) {
        systemPromptParts.push('\nConversation Context:')
        const recentMessages = chatHistory.slice(-4) // Last 4 messages for context
        recentMessages.forEach((msg) => {
          systemPromptParts.push(
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
          )
        })
      }

      systemPromptParts.push(
        "\nUse the provided context to answer the user's question accurately and helpfully, staying in character as defined by your role."
      )

      const customSystemPrompt = systemPromptParts.join('\n\n')

      // Get document IDs for RAG
      const documentIds = documents.map((doc) => doc.id)

      // Prepare RAG request parameters
      const ragRequest = {
        message: userMessage,
        docIds: documentIds,
        customSystemPrompt,
        retrievalConfig: {
          maxChunks: agent.config?.maxTokens
            ? Math.min(5, Math.floor(agent.config.maxTokens / 400))
            : 5,
          minScore: 0.6,
        },
      }

      // Use streaming RAG service
      const ragResponse = await this.ragService.generateStreamingResponse(
        ragRequest,
        onChunk
      )

      return ragResponse
    } catch (error) {
      logger.error('Error generating streaming AI response:', error)
      onChunk({
        type: 'error',
        content: 'Failed to generate response',
      })
      throw new Error('Failed to generate streaming AI response')
    }
  }

  /**
   * Generate basic streaming AI response without RAG (no agent/documents)
   */
  private async generateBasicStreamingResponse(
    userMessage: string,
    conversationHistory: ChatMessage[],
    onChunk: (chunk: {
      type: 'chunk' | 'complete' | 'error' | 'message'
      content: string
      sources?: Array<{
        documentId: string
        documentName: string
        chunkId: string
        relevanceScore: number
      }>
    }) => void
  ): Promise<void> {
    try {
      // Build conversation context for basic chat
      const conversationContext = conversationHistory
        .slice(-10) // Last 10 messages for context
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n')

      const systemPrompt = `You are a helpful AI assistant. Provide clear, concise, and helpful responses.

Conversation history:
${conversationContext}

Current user message: ${userMessage}

Please respond helpfully and naturally.`

      // Use a basic streaming response without RAG
      const basicRequest = {
        message: systemPrompt,
        docIds: [], // No documents
        retrievalConfig: {
          maxChunks: 0, // No retrieval
          minScore: 1.0,
        },
      }

      // Use RAG service in basic mode (no document retrieval)
      await this.ragService.generateStreamingResponse(basicRequest, onChunk)
    } catch (error) {
      logger.error('Error generating basic streaming response:', error)
      onChunk({
        type: 'error',
        content: 'Failed to generate response',
      })
      throw new Error('Failed to generate basic streaming response')
    }
  }

  /**
   * Prepare referenced documents information for response
   */
  private prepareReferencedDocuments(
    referencedChunks: Array<{
      chunkId: string
      score: number
      content: string
    }>,
    documents: Document[]
  ): Array<{
    id: string
    name: string
    relevantChunks: Array<{ id: string; content: string; score: number }>
  }> {
    try {
      const documentMap = new Map<
        string,
        {
          id: string
          name: string
          relevantChunks: Array<{ id: string; content: string; score: number }>
        }
      >()

      for (const refChunk of referencedChunks) {
        // Find which document this chunk belongs to
        const chunk = ChunkModel.findOne({ id: refChunk.chunkId })
        if (!chunk) continue

        const document = documents.find((doc) => doc.id === chunk.documentId)
        if (!document) continue

        if (!documentMap.has(document.id)) {
          documentMap.set(document.id, {
            id: document.id,
            name: document.name,
            relevantChunks: [],
          })
        }

        const docInfo = documentMap.get(document.id)!
        docInfo.relevantChunks.push({
          id: refChunk.chunkId,
          content: refChunk.content,
          score: refChunk.score,
        })
      }

      return Array.from(documentMap.values())
    } catch (error) {
      logger.error('Error preparing referenced documents:', error)
      return []
    }
  }

  /**
   * Update chat session title
   */
  updateChatSessionTitle(
    sessionId: string,
    userId: string,
    newTitle: string
  ): ChatSession | null {
    try {
      const session = this.getChatSession(sessionId, userId)
      if (!session) {
        return null
      }

      const updatedSession = ChatSessionModel.save({
        ...session,
        title: newTitle,
        updatedAt: new Date(),
      })

      return updatedSession
    } catch (error) {
      logger.error('Error updating chat session title:', error)
      throw new Error('Failed to update chat session title')
    }
  }

  /**
   * Delete a chat session
   */
  deleteChatSession(sessionId: string, userId: string): boolean {
    try {
      const session = this.getChatSession(sessionId, userId)
      if (!session) {
        return false
      }

      // Soft delete by marking as inactive
      const updatedSession = ChatSessionModel.save({
        ...session,
        isActive: false,
        updatedAt: new Date(),
      })

      return !!updatedSession
    } catch (error) {
      logger.error('Error deleting chat session:', error)
      throw new Error('Failed to delete chat session')
    }
  }

  /**
   * Generate a meaningful session title based on user message and AI response
   */
  private async generateSessionTitle(
    userMessage: string,
    aiResponse: string
  ): Promise<string> {
    try {
      // Create a prompt to generate a concise title
      const titlePrompt = `Based on this conversation, generate a short, descriptive title (maximum 6 words):

User: ${userMessage.substring(0, 200)}
Assistant: ${aiResponse.substring(0, 200)}

Generate a title that captures the main topic or question. Examples:
- "JavaScript Array Methods"
- "Python Data Structures Help" 
- "Recipe for Chocolate Cake"
- "Career Advice Discussion"
- "Budget Planning Tips"

Title:`

      const titleResponse = await this.ragService.generateResponse({
        message: titlePrompt,
        docIds: [], // No document context needed for title generation
        customSystemPrompt:
          'You are a helpful assistant that generates short, descriptive titles. Respond with just the title, nothing else. Keep it under 6 words and make it specific to the conversation topic.',
        retrievalConfig: {
          maxChunks: 0,
          minScore: 1.0,
        },
      })

      // Clean up the title response
      let title = titleResponse.answer.trim()

      // Remove quotes if present
      title = title.replace(/^["']|["']$/g, '')

      // Limit to reasonable length and ensure it doesn't contain line breaks
      title = title.split('\n')[0].substring(0, 50).trim()

      // Fallback to a generic title based on user message if generation fails
      if (!title || title.length < 3) {
        title = this.generateFallbackTitle(userMessage)
      }

      return title
    } catch (error) {
      logger.error('Error generating session title:', error)
      return this.generateFallbackTitle(userMessage)
    }
  }

  /**
   * Generate a fallback title when AI generation fails
   */
  private generateFallbackTitle(userMessage: string): string {
    // Extract key words from user message
    const message = userMessage.toLowerCase().trim()

    // Common patterns for quick title generation
    if (message.includes('how to') || message.includes('how do')) {
      return 'How-to Question'
    }
    if (message.includes('what is') || message.includes('what are')) {
      return 'Definition Request'
    }
    if (message.includes('explain') || message.includes('help me understand')) {
      return 'Explanation Needed'
    }
    if (message.includes('help') || message.includes('problem')) {
      return 'Help Request'
    }
    if (
      message.includes('create') ||
      message.includes('make') ||
      message.includes('build')
    ) {
      return 'Creation Task'
    }
    if (
      message.includes('code') ||
      message.includes('program') ||
      message.includes('function')
    ) {
      return 'Programming Help'
    }

    // Extract first few meaningful words
    const words = userMessage
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter((word) => word.length > 2)
      .slice(0, 3)

    if (words.length > 0) {
      return words.join(' ').substring(0, 30)
    }

    // Final fallback
    return 'Chat Session'
  }

  /**
   * Get chat sessions for a specific agent
   */
  getAgentChatSessions(agentId: string, userId: string): ChatSession[] {
    try {
      // Verify agent access
      const agent = this.agentService.getAgentById(agentId, userId)
      if (!agent) {
        throw new Error('Agent not found or access denied')
      }

      const userSessions = this.getUserChatSessions(userId)
      return userSessions.filter((session) => session.agentId === agentId)
    } catch (error) {
      logger.error('Error fetching agent chat sessions:', error)
      throw new Error('Failed to fetch agent chat sessions')
    }
  }
}
