#!/usr/bin/env tsx

/**
 * Document Cleanup Script (TypeScript)
 *
 * This script can be run periodically (e.g., via cron job) to clean up
 * orphaned documents that are no longer associated with any agents.
 *
 * Usage:
 *   npm run cleanup:documents:ts
 *   npx tsx scripts/cleanup-documents.ts
 */

import { AgentService } from '../services/agent.service'
import logger from '../utils/logger'

function main(): void {
  try {
    logger.info('Starting orphaned documents cleanup...')

    const agentService = new AgentService()
    const cleanedCount = agentService.cleanupOrphanedDocuments()

    // eslint-disable-next-line no-console
    console.log(`✅ Cleanup completed successfully!`)
    // eslint-disable-next-line no-console
    console.log(`📁 Removed ${cleanedCount} orphaned documents`)

    if (cleanedCount === 0) {
      // eslint-disable-next-line no-console
      console.log('🎉 No orphaned documents found - system is clean!')
    }

    process.exit(0)
  } catch (error) {
    logger.error('Cleanup script failed:', error)
    // eslint-disable-next-line no-console
    console.error(
      '❌ Cleanup failed:',
      error instanceof Error ? error.message : String(error)
    )
    process.exit(1)
  }
}

// Handle script termination gracefully
process.on('SIGINT', () => {
  // eslint-disable-next-line no-console
  console.log('\n⚠️  Cleanup interrupted by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('\n⚠️  Cleanup terminated')
  process.exit(0)
})

// Run the script
main()
