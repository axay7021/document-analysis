import { Router } from 'express'

import agentRoutes from './agents/agents.route'
import authRoutes from './auth/auth.route'
import chatRoutes from './chat/chat.route'

const router = Router()
// Authentication routes (no auth middleware)
router.use('/auth', authRoutes)

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
