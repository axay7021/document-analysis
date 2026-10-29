import { createServer } from 'http'

import app from './app'
import config from './config'
import { AppInitializationService } from './services/appInitialization.service'
import logger from './utils/logger'

const PORT = Number(config.PORT ?? 8080)

const log = () => {
  logger.info(`Server is running on port ${PORT}`)
}

// UNHANDLED EXCEPTION, WHEN FACE SOME DEVELOPER ERROR
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception! SHUTTING DOWN...', {
    meta: {
      name: err.name,
      message: err.message,
    },
  })
  process.exit(1)
})

// Create HTTP server and integrate Socket.IO
const server = createServer(app)
// Initialize application before starting server
const startServer = async () => {
  try {
    // Initialize all services including vector database
    await AppInitializationService.initializeApp()

    const listen = server.listen(PORT, '0.0.0.0', log)

    // UNHANDLED REJECTION, WHEN FACE SOME PROGRAMMATIC ERROR
    process.on('unhandledRejection', (err: unknown) => {
      const error = err as Error
      logger.error('Uncaught Rejection! SHUTTING DOWN...', {
        meta: {
          name: error.name,
          message: error.message,
        },
      })

      listen.close(() => process.exit(1))
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
void startServer()
