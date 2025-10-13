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
  agentId: string
  title?: string
}

export interface ChatMessageRequest {
  sessionId: string
  userId: string
  message: string
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
  }

  /**
   * Create a new chat session with an agent
   */
  createChatSession(request: CreateChatSessionRequest): ChatSession {
    try {
      // Validate that agent exists and belongs to user
      const agent = this.agentService.getAgentById(
        request.agentId,
        request.userId
      )
      if (!agent) {
        throw new Error('Agent not found or access denied')
      }

      const sessionData: Omit<ChatSession, 'id'> = {
        userId: request.userId,
        agentId: request.agentId,
        title: request.title || `Chat with ${agent.name}`,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      }

      const session = ChatSessionModel.create(sessionData)
      logger.info(
        `Chat session created: ${session.id} for agent: ${agent.name}`
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
      // This would need to be implemented in the FileStorage service
      // For now, we'll use a workaround
      const allSessions = ChatSessionModel.find({})
      return allSessions.filter(
        (session) => session.userId === userId && session.isActive
      )
    } catch (error) {
      logger.error('Error fetching user chat sessions:', error)
      throw new Error('Failed to fetch chat sessions')
    }
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

      // Get agent context (agent + associated documents)
      const agentContext = this.agentService.getAgentContext(
        session.agentId,
        request.userId
      )

      if (!agentContext) {
        throw new Error('Agent not found or access denied')
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
      const updatedSession = ChatSessionModel.save({
        ...session,
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
