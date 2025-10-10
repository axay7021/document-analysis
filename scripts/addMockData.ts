import mongoose from 'mongoose'

import mongooseInit from '../init/database'
import Company from '../models/company/company.model'
import Job from '../models/job/job.model'
import logger from '../utils/logger'
import mockJobs from './jobsData'

export const addMockData = async () => {
  try {
    // Connect to database
    await mongooseInit()
    logger.info('Connected to database')

    // Create a company
    const companyData = {
      name: 'TechCorp Solutions',
      industry: 'technology',
      location: 'san francisco, ca',
      size: '100-500',
      status: 'active',
    }

    // Check if company already exists
    let company = await Company.findOne({ name: companyData.name })

    if (!company) {
      company = await Company.create(companyData)
      logger.info(`Created company: ${company.name}`)
    } else {
      logger.info(`Company already exists: ${company.name}`)
    }

    // Add jobs to the company
    const jobsToCreate = mockJobs.map((job) => ({
      ...job,
      company: company._id,
      status: 'active' as const,
    }))

    // Check for existing jobs to avoid duplicates
    const existingJobTitles = await Job.find({
      company: company.id,
    }).select('title')

    const existingTitles = existingJobTitles.map((job) =>
      job.title.toLowerCase()
    )

    const newJobs = jobsToCreate.filter(
      (job) => !existingTitles.includes(job.title.toLowerCase())
    )

    if (newJobs.length > 0) {
      const createdJobs = await Job.insertMany(newJobs)
      logger.info(`Created ${createdJobs.length} new jobs`)
    } else {
      logger.info('All jobs already exist for this company')
    }

    // Get total job count for the company
    const totalJobs = await Job.countDocuments({ company: company.id })
    logger.info(`Total jobs for ${company.name}: ${totalJobs}`)

    logger.info('Mock data addition completed successfully')
  } catch (error: unknown) {
    logger.error('Error adding mock data:', error)
    throw error
  } finally {
    // Close database connection
    await mongoose.disconnect()
    logger.info('Database connection closed')
  }
}

// Run the script if called directly
if (require.main === module) {
  addMockData()
    .then(() => {
      logger.info('Script completed successfully')
      process.exit(0)
    })
    .catch((error: unknown) => {
      logger.error('Script failed:', error)
      process.exit(1)
    })
}
