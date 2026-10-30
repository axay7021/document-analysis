import { aiConfigured } from '../services/aiProvider'
import { Router } from 'express'
import config from '../config'

import agentRoutes from './agents/agents.route'
import authRoutes from './auth/auth.route'
import chatRoutes from './chat/chat.route'

const router = Router()
// Authentication routes (no auth middleware)
router.use('/auth', authRoutes)

// Fail clearly before accepting AI-dependent uploads or opening SSE streams.
router.use((req, res, next) => {
  const needsAI =
    req.method === 'POST' &&
    ((req.path.startsWith('/prompts') &&
      req.headers['content-type']?.includes('multipart/form-data')) ||
      req.path.endsWith('/messages'))
  if (needsAI && !aiConfigured()) {
    res
      .status(503)
      .json({
        success: false,
        code: 'AI_NOT_CONFIGURED',
        message:
          'AI service is not configured yet. The owner must configure the selected AI provider.',
      })
    return
  }
  next()
})

// Agent management routes
router.use('/prompts', agentRoutes)

// Chat management routes
router.use('/chat', chatRoutes)

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Multi-Agent Chat Platform API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
})

export default router
