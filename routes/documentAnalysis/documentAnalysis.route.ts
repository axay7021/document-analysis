import { Router } from 'express'

import { DocumentAnalysisController } from '../../controllers/documentAnalysis.controller'
import { mockAuth } from '../../middlewares/mockAuth'
import {
  uploadMultiple,
  uploadSingle,
} from '../../middlewares/upload.middleware'

const router = Router()
const controller = new DocumentAnalysisController()

// Apply mock auth middleware to all routes (remove in production)
router.use(mockAuth)

/**
 * @route POST /api/v1/documents/upload
 * @desc Upload a document (PDF or text file)
 */
router.post(
  '/upload',
  uploadSingle,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  controller.uploadDocument.bind(controller)
)

/**
 * @route GET /api/v1/documents
 * @desc List user's documents
 */
router.get('/', controller.listDocuments.bind(controller))

/**
 * @route DELETE /api/v1/documents/:documentId
 * @desc Delete a document and its chunks
 */
router.delete('/:documentId', controller.deleteDocument.bind(controller))

/**
 * @route POST /api/v1/chat
 * @desc Create a new chat session
 */
router.post('/chat', controller.createChatSession.bind(controller))

/**
 * @route GET /api/v1/chat
 * @desc List user's chat sessions
 */
router.get('/chat', controller.listChatSessions.bind(controller))

/**
 * @route GET /api/v1/chat/:chatId
 * @desc Get chat session history
 */
router.get('/chat/:chatId', controller.getChatSession.bind(controller))

/**
 * @route POST /api/v1/documents/upload-multiple
 * @desc Upload multiple documents at once
 */
router.post(
  '/upload-multiple',
  uploadMultiple,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  controller.uploadMultipleDocuments.bind(controller)
)

/**
 * @route POST /api/v1/chat/:chatId/message
 * @desc Send a message in a chat session
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/chat/:chatId/message', controller.sendMessage.bind(controller))

/**
 * @route GET /api/v1/system-prompts
 * @desc Get available system prompts
 */
router.get('/system-prompts', controller.listSystemPrompts.bind(controller))

/**
 * @route GET /api/v1/upload-stats
 * @desc Get upload statistics
 */
router.get('/upload-stats', controller.getUploadStats.bind(controller))

export default router
