/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express'

import { ChatController } from '../../controllers/chat.controller'
import { authMiddleware } from '../../middlewares/auth.middleware'
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validation.middleware'
import {
  agentIdParamsSchema,
  chatSessionsQuerySchema,
  createChatSessionSchema,
  sendMessageSchema,
  sessionIdParamsSchema,
  updateChatSessionTitleSchema,
} from '../../schemas/chat.schema'

const router = Router()
const chatController = new ChatController()

// Apply authentication to all routes
router.use(authMiddleware)

/**
 * @route POST /api/v1/chat/sessions
 * @desc Create a new chat session with an agent
 */
router.post(
  '/sessions',
  validateBody(createChatSessionSchema),
  chatController.createChatSession.bind(chatController)
)

/**
 * @route GET /api/v1/chat/sessions
 * @desc Get all chat sessions for the current user
 */
router.get(
  '/sessions',
  validateQuery(chatSessionsQuerySchema),
  chatController.getUserChatSessions.bind(chatController)
)

/**
 * @route GET /api/v1/chat/sessions/:sessionId
 * @desc Get a specific chat session
 */
router.get(
  '/sessions/:sessionId',
  validateParams(sessionIdParamsSchema),
  chatController.getChatSession.bind(chatController)
)

/**
 * @route POST /api/v1/chat/sessions/:sessionId/messages
 * @desc Send a message in a chat session
 */
router.post(
  '/sessions/:sessionId/messages',
  validateParams(sessionIdParamsSchema),
  validateBody(sendMessageSchema),
  chatController.sendMessage.bind(chatController)
)

/**
 * @route PUT /api/v1/chat/sessions/:sessionId/title
 * @desc Update chat session title
 */
router.put(
  '/sessions/:sessionId/title',
  validateParams(sessionIdParamsSchema),
  validateBody(updateChatSessionTitleSchema),
  chatController.updateChatSessionTitle.bind(chatController)
)

/**
 * @route DELETE /api/v1/chat/sessions/:sessionId
 * @desc Delete a chat session
 */
router.delete(
  '/sessions/:sessionId',
  validateParams(sessionIdParamsSchema),
  chatController.deleteChatSession.bind(chatController)
)

/**
 * @route GET /api/v1/chat/agents/:agentId/sessions
 * @desc Get chat sessions for a specific agent
 */
router.get(
  '/agents/:agentId/sessions',
  validateParams(agentIdParamsSchema),
  validateQuery(chatSessionsQuerySchema),
  chatController.getAgentChatSessions.bind(chatController)
)

export default router
