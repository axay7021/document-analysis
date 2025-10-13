#!/usr/bin/env node

/**
 * Document Cleanup Script
 *
 * This script can be run periodically (e.g., via cron job) to clean up
 * orphaned documents that are no longer associated with any agents.
 *
 * Usage:
 *   npm run cleanup:documents
 *   node scripts/cleanup-documents.js
 */

import { AgentService } from '../services/agent.service'
import logger from '../utils/logger'

async function main() {
  try {
    logger.info('Starting orphaned documents cleanup...')

    const agentService = new AgentService()
    const cleanedCount = agentService.cleanupOrphanedDocuments()

    console.log(`✅ Cleanup completed successfully!`)
    console.log(`📁 Removed ${cleanedCount} orphaned documents`)

    if (cleanedCount === 0) {
      console.log('🎉 No orphaned documents found - system is clean!')
    }

    process.exit(0)
  } catch (error) {
    logger.error('Cleanup script failed:', error)
    console.error(
      '❌ Cleanup failed:',
      error instanceof Error ? error.message : error
    )
    process.exit(1)
  }
}

// Handle script termination gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️  Cleanup interrupted by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n⚠️  Cleanup terminated')
  process.exit(0)
})

// Run the script
main()
