import fs from 'node:fs'
import path from 'node:path'

import logger from '../utils/logger'

/**
 * Initialize required directories for file uploads and data storage
 */
export function initializeDirectories(): void {
  const directories = [
    path.join(process.cwd(), 'uploads', 'documents'),
    path.join(process.cwd(), 'data', 'faiss'),
    path.join(process.cwd(), 'data', 'backups'),
  ]

  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        logger.info(`Created directory: ${dir}`)
      }
    } catch (error) {
      logger.error(`Failed to create directory ${dir}:`, error)
      throw error
    }
  }

  logger.info('Directory initialization completed')
}
