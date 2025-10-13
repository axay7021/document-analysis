import type { Request, Response } from 'express'

import {
  ChatService,
  ChatMessageRequest,
  CreateChatSessionRequest,
} from '../services/chat.service'
import httpResponse from '../utils/httpResponse'
import logger from '../utils/logger'

export class ChatController {
  private chatService: ChatService

  constructor() {
    this.chatService = new ChatService()
  }

  /**
   * Create a new chat session with an agent
   */
  createChatSession = (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      const { agentId, title } = req.body

      if (!agentId) {
        httpResponse(req, res, 400, 'Agent ID is required')
        return
      }

      const requestData: CreateChatSessionRequest = {
        userId: req.user.id,
        agentId,
        title,
      }

      const session = this.chatService.createChatSession(requestData)

      httpResponse(req, res, 201, 'Chat session created successfully', {
        session,
      })
    } catch (error) {
      logger.error('Error creating chat session:', error)
      if (error instanceof Error) {
        if (error.message.includes('Agent not found')) {
          httpResponse(req, res, 404, error.message)
          return
        }
      }
      httpResponse(req, res, 500, 'Failed to create chat session')
    }
  }

  /**
   * Get all chat sessions for the current user
   */
  getUserChatSessions = (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      const sessions = this.chatService.getUserChatSessions(req.user.id)

      httpResponse(req, res, 200, 'Chat sessions retrieved successfully', {
        sessions,
        count: sessions.length,
      })
    } catch (error) {
      logger.error('Error fetching chat sessions:', error)
      httpResponse(req, res, 500, 'Failed to fetch chat sessions')
    }
  }

  /**
   * Get a specific chat session
   */
  getChatSession = (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      const { sessionId } = req.params

      if (!sessionId) {
        httpResponse(req, res, 400, 'Session ID is required')
        return
      }

      const session = this.chatService.getChatSession(sessionId, req.user.id)

      if (!session) {
        httpResponse(req, res, 404, 'Chat session not found')
        return
      }

      httpResponse(req, res, 200, 'Chat session retrieved successfully', {
        session,
      })
    } catch (error) {
      logger.error('Error fetching chat session:', error)
      httpResponse(req, res, 500, 'Failed to fetch chat session')
    }
  }

  /**
   * Send a message in a chat session
   */
  public sendMessage = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      const { sessionId } = req.params
      const { message } = req.body

      if (!sessionId || !message) {
        httpResponse(req, res, 400, 'Session ID and message are required')
        return
      }

      if (typeof message !== 'string' || message.trim().length === 0) {
        httpResponse(req, res, 400, 'Message must be a non-empty string')
        return
      }

      const requestData: ChatMessageRequest = {
        sessionId,
        userId: req.user.id,
        message: message.trim(),
      }

      const chatResponse = await this.chatService.sendMessage(requestData)

      httpResponse(req, res, 200, 'Message sent successfully', chatResponse)
    } catch (error) {
      logger.error('Error sending message:', error)
      if (error instanceof Error) {
        if (
          error.message.includes('not found') ||
          error.message.includes('access denied')
        ) {
          httpResponse(req, res, 404, error.message)
          return
        }
      }
      httpResponse(req, res, 500, 'Failed to send message')
    }
  }

  /**
   * Update chat session title
   */
  updateChatSessionTitle = (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      const { sessionId } = req.params
      const { title } = req.body

      if (!sessionId || !title) {
        httpResponse(req, res, 400, 'Session ID and title are required')
        return
      }

      if (typeof title !== 'string' || title.trim().length === 0) {
        httpResponse(req, res, 400, 'Title must be a non-empty string')
        return
      }

      const updatedSession = this.chatService.updateChatSessionTitle(
        sessionId,
        req.user.id,
        title.trim()
      )

      if (!updatedSession) {
        httpResponse(req, res, 404, 'Chat session not found')
        return
      }

      httpResponse(req, res, 200, 'Chat session title updated successfully', {
        session: updatedSession,
      })
    } catch (error) {
      logger.error('Error updating chat session title:', error)
      httpResponse(req, res, 500, 'Failed to update chat session title')
    }
  }

  /**
   * Delete a chat session
   */
  deleteChatSession = (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      const { sessionId } = req.params

      if (!sessionId) {
        httpResponse(req, res, 400, 'Session ID is required')
        return
      }

      const deleted = this.chatService.deleteChatSession(sessionId, req.user.id)

      if (!deleted) {
        httpResponse(req, res, 404, 'Chat session not found')
        return
      }

      httpResponse(req, res, 200, 'Chat session deleted successfully')
    } catch (error) {
      logger.error('Error deleting chat session:', error)
      httpResponse(req, res, 500, 'Failed to delete chat session')
    }
  }

  /**
   * Get chat sessions for a specific agent
   */
  getAgentChatSessions = (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        httpResponse(req, res, 401, 'Authentication required')
        return
      }

      const { agentId } = req.params

      if (!agentId) {
        httpResponse(req, res, 400, 'Agent ID is required')
        return
      }

      const sessions = this.chatService.getAgentChatSessions(
        agentId,
        req.user.id
      )

      httpResponse(
        req,
        res,
        200,
        'Agent chat sessions retrieved successfully',
        {
          sessions,
          count: sessions.length,
          agentId,
        }
      )
    } catch (error) {
      logger.error('Error fetching agent chat sessions:', error)
      if (error instanceof Error) {
        if (error.message.includes('Agent not found')) {
          httpResponse(req, res, 404, error.message)
          return
        }
      }
      httpResponse(req, res, 500, 'Failed to fetch agent chat sessions')
    }
  }
}
