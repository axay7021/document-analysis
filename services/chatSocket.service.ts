import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'

import config from '../config'
import logger from '../utils/logger'
import { ChatService } from './chat.service'

interface SocketUser {
  userId: string
  sessionId?: string
  // agentId is no longer stored here as agents are now tagged per message
}

interface JoinChatPayload {
  sessionId?: string // Optional - will create/use default session if not provided
  token: string
}

interface SendMessagePayload {
  message: string
  sessionId?: string // Optional - uses the session from the socket connection if not provided
  agentId?: string // Optional agent ID for tagging agents in messages
}

interface ChatStreamChunk {
  type: 'chunk' | 'complete' | 'error' | 'message'
  content: string
  messageId?: string
  sources?: Array<{
    documentId: string
    documentName: string
    chunkId: string
    relevanceScore: number
  }>
}

export class ChatSocketService {
  private io: Server
  private chatService: ChatService
  private activeUsers: Map<string, SocketUser> = new Map()

  constructor(io: Server) {
    this.io = io
    this.chatService = new ChatService()
  }

  /**
   * Parse agent mentions from message text (e.g., @agentName)
   */
  private parseAgentMention(message: string, userId: string): string | null {
    // Look for @mentions in the message
    const mentionRegex = /@(\w+)/
    const match = message.match(mentionRegex)

    if (match && match[1]) {
      const agentName = match[1]
      // Use the agent service to find the agent by name
      const agent = this.chatService.getAgentByName(agentName, userId)
      return agent?.id || null
    }

    return null
  }

  /**
   * Initialize socket event handlers
   */
  initialize(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Socket connected: ${socket.id}`)

      // Handle chat room joining
      socket.on('join_chat', (payload: JoinChatPayload) => {
        this.handleJoinChat(socket, payload)
      })

      // Handle message sending
      socket.on('send_message', (payload: SendMessagePayload) => {
        void this.handleSendMessage(socket, payload)
      })

      // Handle typing indicators
      socket.on('typing_start', (sessionId: string) => {
        this.handleTypingStart(socket, sessionId)
      })

      socket.on('typing_stop', (sessionId: string) => {
        this.handleTypingStop(socket, sessionId)
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })

      // Handle errors
      socket.on('error', (error: Error) => {
        logger.error(`Socket error for ${socket.id}:`, error)
      })
    })

    logger.info('Chat socket service initialized')
  }

  /**
   * Handle user joining a chat session
   */
  private handleJoinChat(socket: Socket, payload: JoinChatPayload): void {
    try {
      // Verify JWT token
      const decoded = jwt.verify(payload.token, config.JWT_SECRET) as {
        userId: string
      }
      const { userId } = decoded

      // Get or create chat session
      let session
      if (payload.sessionId) {
        // Specific session requested
        session = this.chatService.getChatSession(payload.sessionId, userId)
        if (!session) {
          socket.emit('error', {
            type: 'CHAT_ERROR',
            message: 'Chat session not found or access denied',
          })
          return
        }
      } else {
        // No session specified, get or create default session
        try {
          session = this.chatService.getOrCreateDefaultChatSession(userId)
        } catch {
          socket.emit('error', {
            type: 'CHAT_ERROR',
            message: 'Failed to create chat session',
          })
          return
        }
      }

      // Store user info (no agent binding at session level)
      const userInfo: SocketUser = {
        userId,
        sessionId: session.id, // Use the actual session ID from the session object
      }
      this.activeUsers.set(socket.id, userInfo)

      // Join the chat room
      const roomName = `chat_${session.id}`
      void socket.join(roomName)

      // Send session details and message history
      socket.emit('chat_joined', {
        session,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        messages: session.messages || [],
        status: 'connected',
      })

      // Notify others in the room (if any)
      socket.to(roomName).emit('user_joined', {
        userId,
        timestamp: new Date(),
      })

      logger.info(
        `User ${userId} joined chat session ${session.id} on socket ${socket.id}`
      )
    } catch (error) {
      logger.error('Error joining chat:', error)
      socket.emit('error', {
        type: 'AUTH_ERROR',
        message: 'Invalid token or chat session access denied',
      })
    }
  }

  /**
   * Handle message sending with streaming response
   */
  private async handleSendMessage(
    socket: Socket,
    payload: SendMessagePayload
  ): Promise<void> {
    try {
      // Debug logging
      logger.info('Received send_message payload:', {
        payload,
        socketId: socket.id,
      })

      logger.debug('Active users map:', Array.from(this.activeUsers.entries()))

      // Validate payload
      if (
        !payload.message ||
        typeof payload.message !== 'string' ||
        payload.message.trim() === ''
      ) {
        logger.warn('Invalid message payload:', { payload })
        socket.emit('error', {
          type: 'CHAT_ERROR',
          message: 'Message is required and must be a non-empty string',
        })
        return
      }

      const userInfo = this.activeUsers.get(socket.id)
      if (!userInfo || !userInfo.sessionId) {
        socket.emit('error', {
          type: 'CHAT_ERROR',
          message: 'Not connected to a chat session',
        })
        return
      }

      const roomName = `chat_${userInfo.sessionId}`

      // Validate session access - use the session from the socket connection
      // payload.sessionId is now optional, so we use userInfo.sessionId
      const { sessionId } = userInfo

      if (!sessionId) {
        socket.emit('error', {
          type: 'CHAT_ERROR',
          message: 'Not connected to a valid chat session',
        })
        return
      }

      if (payload.sessionId && payload.sessionId !== sessionId) {
        socket.emit('error', {
          type: 'CHAT_ERROR',
          message: 'Session ID mismatch',
        })
        return
      }

      // Send user message to all clients in the room
      const trimmedMessage = payload.message.trim()
      const userMessage = {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: trimmedMessage,
        role: 'user' as const,
        timestamp: new Date(),
        sessionId: sessionId,
        userId: userInfo.userId,
      }

      this.io.to(roomName).emit('message_received', userMessage)

      // Start AI response with streaming
      socket.emit('ai_response_start', {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        messageId: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      })

      // Check for agent mentions in the message
      const mentionedAgentId = this.parseAgentMention(
        trimmedMessage,
        userInfo.userId
      )
      const targetAgentId = payload.agentId || mentionedAgentId || undefined

      // Generate streaming AI response with agent tagging
      await this.generateStreamingResponse(socket, roomName, {
        sessionId: sessionId,
        userId: userInfo.userId,
        message: trimmedMessage,
        agentId: targetAgentId, // Use explicitly tagged agent or mentioned agent
      })
    } catch (error) {
      logger.error('Error sending message:', error)
      socket.emit('error', {
        type: 'MESSAGE_ERROR',
        message: 'Failed to send message',
      })
    }
  }

  /**
   * Generate streaming AI response
   */
  private async generateStreamingResponse(
    socket: Socket,
    roomName: string,
    request: {
      sessionId: string
      userId: string
      message: string
      agentId?: string // Optional agent ID for agent tagging
    }
  ): Promise<void> {
    try {
      // Send the message using the existing chat service with streaming callback
      const response = await this.chatService.sendMessageWithStreaming(
        {
          sessionId: request.sessionId,
          userId: request.userId,
          message: request.message,
          agentId: request.agentId, // Pass the agent ID for tagging
        },
        // Streaming callback
        (chunk: ChatStreamChunk) => {
          // Emit each chunk to all clients in the room
          this.io.to(roomName).emit('ai_response_chunk', chunk)
        }
      )

      // Send final response with metadata
      this.io.to(roomName).emit('ai_response_complete', {
        message: response.message,
        referencedDocuments: response.referencedDocuments,
        timestamp: new Date(),
      })

      logger.info(
        `Streaming response completed for session ${request.sessionId}`
      )
    } catch (error) {
      logger.error('Error generating streaming response:', error)

      // Send error to all clients in the room
      this.io.to(roomName).emit('ai_response_error', {
        error: 'Failed to generate response',
        timestamp: new Date(),
      })
    }
  }

  /**
   * Handle typing start indicator
   */
  private handleTypingStart(socket: Socket, sessionId: string): void {
    const userInfo = this.activeUsers.get(socket.id)
    if (!userInfo || userInfo.sessionId !== sessionId) return

    const roomName = `chat_${sessionId}`
    socket.to(roomName).emit('user_typing_start', {
      userId: userInfo.userId,
      timestamp: new Date(),
    })
  }

  /**
   * Handle typing stop indicator
   */
  private handleTypingStop(socket: Socket, sessionId: string): void {
    const userInfo = this.activeUsers.get(socket.id)
    if (!userInfo || userInfo.sessionId !== sessionId) return

    const roomName = `chat_${sessionId}`
    socket.to(roomName).emit('user_typing_stop', {
      userId: userInfo.userId,
      timestamp: new Date(),
    })
  }

  /**
   * Handle user disconnection
   */
  private handleDisconnect(socket: Socket): void {
    const userInfo = this.activeUsers.get(socket.id)
    if (userInfo && userInfo.sessionId) {
      const roomName = `chat_${userInfo.sessionId}`

      // Notify others in the room
      socket.to(roomName).emit('user_left', {
        userId: userInfo.userId,
        timestamp: new Date(),
      })

      logger.info(
        `User ${userInfo.userId} disconnected from chat session ${userInfo.sessionId}`
      )
    }

    // Remove user from active users
    this.activeUsers.delete(socket.id)
    logger.info(`Socket disconnected: ${socket.id}`)
  }

  /**
   * Get active users count for a session
   */
  public getActiveUsersInSession(sessionId: string): number {
    return Array.from(this.activeUsers.values()).filter(
      (user) => user.sessionId === sessionId
    ).length
  }

  /**
   * Broadcast system message to a session
   */
  public broadcastToSession(
    sessionId: string,
    event: string,
    data: Record<string, unknown>
  ): void {
    const roomName = `chat_${sessionId}`
    this.io.to(roomName).emit(event, {
      ...data,
      timestamp: new Date(),
    })
  }
}
