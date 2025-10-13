import { Router } from 'express'

import * as agentController from '../../controllers/agent.controller.functions'
import { authMiddleware } from '../../middlewares/auth.middleware'
import { uploadMultiple } from '../../middlewares/upload.middleware'
import {
  validateParams,
  validateQuery,
} from '../../middlewares/validation.middleware'
import { agentIdSchema, agentsQuerySchema } from '../../schemas/agent.schema'

const router = Router()

// Apply authentication to all routes
router.use(authMiddleware)

/**
 * @route POST /api/v1/agents/create
 * @desc Create a new agent (supports both JSON and multipart/form-data with files)
 */
router.post('/create', uploadMultiple, (req, res) => {
  agentController.createAgent(req, res).catch((_error: unknown) => {
    // Error is already handled in the controller
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

/**
 * @route GET /api/v1/agents
 * @desc Get all agents for current user
 */
router.get('/', validateQuery(agentsQuerySchema), agentController.getUserAgents)

/**
 * @route GET /api/v1/agents/:agentId
 * @desc Get specific agent by ID
 */
router.get('/:agentId', validateParams(agentIdSchema), agentController.getAgent)

/**
 * @route PUT /api/v1/agents/:agentId
 * @desc Update an agent (supports both JSON and multipart/form-data with files)
 */
router.put(
  '/:agentId',
  uploadMultiple,
  validateParams(agentIdSchema),
  (req, res) => {
    agentController.updateAgent(req, res).catch((_error: unknown) => {
      // Error is already handled in the controller
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    })
  }
)

/**
 * @route DELETE /api/v1/agents/:agentId
 * @desc Delete an agent
 */
router.delete(
  '/:agentId',
  validateParams(agentIdSchema),
  agentController.deleteAgent
)

/**
 * @route POST /api/v1/agents/cleanup/orphaned-documents
 * @desc Clean up orphaned documents (admin utility)
 */
router.post(
  '/cleanup/orphaned-documents',
  agentController.cleanupOrphanedDocuments
)

export default router
