import responseMessage from '../constants/responseMessage'
import Company from '../models/company/company.model'
import Job from '../models/job/job.model'
import { JobSchema } from '../models/job/job.types'
import globalHandler from '../utils/globalHandler'
import httpResponse from '../utils/httpResponse'

export const getJobs = globalHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    location,
    type,
    workMode,
    experience,
    minSalary,
    maxSalary,
  } = req.query as unknown as {
    page: number
    limit: number
    search?: string
    location?: string
    type?: string
    workMode?: string
    experience?: string
    minSalary?: number
    maxSalary?: number
  }

  // Build match conditions
  const matchConditions: Record<string, unknown> = { isDeleted: { $ne: true } }

  // 1. Search by input field (searches in title, description, requirements, responsibilities, benefits, skills)
  if (search) {
    matchConditions.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { requirements: { $regex: search, $options: 'i' } },
      { responsibilities: { $regex: search, $options: 'i' } },
      { benefits: { $regex: search, $options: 'i' } },
      { skills: { $regex: search, $options: 'i' } },
    ]
  }

  // 2. Search by location
  if (location) {
    matchConditions.location = { $regex: location, $options: 'i' }
  }

  // 3. Search by job type
  if (type) {
    const typeArray = type.split(',').map((t) => t.trim())
    matchConditions.type = { $in: typeArray }
  }

  // 4. Search by work mode (locationRequirements)
  if (workMode) {
    const workModeArray = workMode.split(',').map((w) => w.trim())
    matchConditions.locationRequirements = { $in: workModeArray }
  }

  // 5. Search by experience
  if (experience) {
    const experienceArray = experience.split(',').map((e) => e.trim())
    matchConditions.experience = { $in: experienceArray }
  }

  // 6. Search by salary range
  if (minSalary || maxSalary) {
    if (!matchConditions.$and) {
      matchConditions.$and = []
    }

    if (minSalary && maxSalary) {
      ;(matchConditions.$and as unknown[]).push({
        $or: [
          { minSalary: { $gte: minSalary, $lte: maxSalary } },
          { maxSalary: { $gte: minSalary, $lte: maxSalary } },
          {
            $and: [
              { minSalary: { $lte: minSalary } },
              { maxSalary: { $gte: maxSalary } },
            ],
          },
        ],
      })
    } else if (minSalary) {
      ;(matchConditions.$and as unknown[]).push({
        maxSalary: { $gte: minSalary },
      })
    } else if (maxSalary) {
      ;(matchConditions.$and as unknown[]).push({
        minSalary: { $lte: maxSalary },
      })
    }
  }

  const jobs = await Job.aggregatePaginate(
    Job.aggregate([
      {
        $match: matchConditions,
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          company: 1,
          type: 1,
          location: 1,
          locationRequirements: 1,
          minSalary: 1,
          maxSalary: 1,
          description: 1,
          experience: 1,
          education: 1,
          postedDate: 1,
          deadline: 1,
          status: 1,
          createdAt: 1,
          requirements: 1,
          responsibilities: 1,
          benefits: 1,
          skills: 1,
        },
      },
    ]),
    {
      page: Number(page),
      limit: Number(limit),
    }
  )

  httpResponse(req, res, 200, responseMessage.DATA_RETRIEVED('Jobs'), {
    jobs,
  })
})

export const getJobById = globalHandler(async (req, res) => {
  const { id } = req.params

  const job = await Job.findOne({
    _id: id,
    isDeleted: { $ne: true },
  }).select({
    _id: 1,
    title: 1,
    company: 1,
    type: 1,
    location: 1,
    locationRequirements: 1,
    minSalary: 1,
    maxSalary: 1,
    description: 1,
    experience: 1,
    education: 1,
    postedDate: 1,
    deadline: 1,
    status: 1,
    requirements: 1,
    responsibilities: 1,
    benefits: 1,
    skills: 1,
    createdAt: 1,
  })

  if (!job) {
    httpResponse(req, res, 404, responseMessage.NOT_FOUND('Job'))
    return
  }

  httpResponse(req, res, 200, responseMessage.DATA_RETRIEVED('Job'), {
    job,
  })
})

export const createJob = globalHandler(async (req, res) => {
  const {
    title,
    company,
    type,
    location,
    locationRequirements,
    minSalary,
    maxSalary,
    description,
    experience,
    education,
    postedDate,
    deadline,
    status,
    requirements,
    responsibilities,
    benefits,
    skills,
  } = req.body as JobSchema

  // check if company already exists
  const existingCompany = await Company.findOne({
    _id: company,
    isDeleted: { $ne: true },
  })

  if (!existingCompany) {
    httpResponse(req, res, 400, responseMessage.NOT_FOUND('Company'))
    return
  }

  // check if job already exists
  const existingJob = await Job.findOne({
    title,
    company,
    isDeleted: { $ne: true },
  })

  if (existingJob) {
    httpResponse(req, res, 400, responseMessage.ALREADY_EXIST('Job'))
    return
  }

  await Job.create({
    title,
    company,
    type,
    location,
    locationRequirements,
    minSalary,
    maxSalary,
    description,
    experience,
    education,
    postedDate,
    deadline,
    status,
    requirements,
    responsibilities,
    benefits,
    skills,
  })

  httpResponse(req, res, 201, responseMessage.DATA_CREATED('Job'))
})
