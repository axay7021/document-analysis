import logger from '../utils/logger'
import { VectorDatabaseService } from './vectorDatabase.enhanced.service'

/**
 * Application initialization utilities
 * Ensures vector database is properly initialized before any operations
 */
export const AppInitializationService = {
  isInitialized: false,
  initializationPromise: null as Promise<void> | null,

  /**
   * Initialize all application services
   * Call this once at application startup
   */
  async initializeApp(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (this.initializationPromise) {
      await this.initializationPromise
      return
    }

    this.initializationPromise = this.performInitialization()
    await this.initializationPromise
  },

  /**
   * Perform the actual initialization
   */
  performInitialization(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info('Starting application initialization...')

        // Initialize vector database
        const vectorDb = VectorDatabaseService.getGlobalInstance()
        vectorDb.initialize()

        const stats = vectorDb.getStats()
        logger.info('Vector database initialized', {
          totalVectors: stats.totalVectors,
          mappingsCount: stats.mappingsCount,
        })

        this.isInitialized = true
        logger.info('Application initialization completed successfully')
        resolve()
      } catch (error) {
        logger.error('Application initialization failed:', error)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  },

  /**
   * Get the initialized vector database instance
   */
  getVectorDatabase(): VectorDatabaseService {
    if (!this.isInitialized) {
      throw new Error(
        'Application not initialized. Call AppInitializationService.initializeApp() first.'
      )
    }
    return VectorDatabaseService.getGlobalInstance()
  },

  /**
   * Check if the application is initialized
   */
  isAppInitialized(): boolean {
    return this.isInitialized
  },
}
