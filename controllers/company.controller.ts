import responseMessage from '../constants/responseMessage'
import Company from '../models/company/company.model'
import { CompanySchema } from '../models/company/company.types'
import globalHandler from '../utils/globalHandler'
import httpResponse from '../utils/httpResponse'

export const createCompany = globalHandler(async (req, res) => {
  const { name, industry, location, size, status } = req.body as CompanySchema

  // check if company already exists
  const existingCompany = await Company.findOne({
    name,
    isDeleted: { $ne: true },
  })
  if (existingCompany) {
    httpResponse(req, res, 400, responseMessage.ALREADY_EXIST('Company'))
    return
  }

  await Company.create({
    name,
    industry,
    location,
    size,
    status,
  })

  httpResponse(req, res, 201, responseMessage.DATA_CREATED('Company'))
})

export const getCompanies = globalHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query as unknown as {
    page: number
    limit: number
  }

  const companies = await Company.aggregatePaginate(
    Company.aggregate([
      {
        $match: { isDeleted: { $ne: true } },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          industry: 1,
          location: 1,
          size: 1,
          status: 1,
          createdAt: 1,
        },
      },
    ]),
    {
      page: Number(page),
      limit: Number(limit),
    }
  )

  httpResponse(req, res, 200, responseMessage.DATA_RETRIEVED('Companies'), {
    companies,
  })
})

export const getCompanyNames = globalHandler(async (req, res) => {
  const companies = await Company.find({
    isDeleted: { $ne: true },
  }).select({
    _id: 1,
    name: 1,
  })

  httpResponse(req, res, 200, responseMessage.DATA_RETRIEVED('Companies'), {
    companies,
  })
})

export const getCompanyById = globalHandler(async (req, res) => {
  const { id } = req.params

  const company = await Company.findOne({
    _id: id,
    isDeleted: { $ne: true },
  }).select({
    _id: 1,
    name: 1,
    industry: 1,
    location: 1,
    size: 1,
    status: 1,
    createdAt: 1,
  })

  if (!company) {
    httpResponse(req, res, 404, responseMessage.NOT_FOUND('Company'))
    return
  }

  httpResponse(req, res, 200, responseMessage.DATA_RETRIEVED('Company'), {
    company,
  })
})
