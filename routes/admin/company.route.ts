import { Router as ExpressRouter } from 'express'

import {
  createCompany,
  getCompanies,
  getCompanyById,
  getCompanyNames,
} from '../../controllers/company.controller'
import { createCompanySchema } from '../../schemas/company.schema'
import { validate } from '../../utils/validate'

const Router = ExpressRouter()

Router.get('/get-companies', getCompanies)
Router.post('/create-company', validate(createCompanySchema), createCompany)
Router.get('/get-company/:id', getCompanyById)
Router.get('/get-company-names', getCompanyNames)

export default Router
