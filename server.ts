import app from './app'
import config from './config'
import logger from './utils/logger'

const PORT = config.PORT ?? 8080

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

const listen = app.listen(PORT, log)

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
