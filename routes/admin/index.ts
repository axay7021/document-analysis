import { Router as ExpressRouter } from 'express'

import companyRoutes from './company.route'
import jobRoutes from './job.route'

const Router = ExpressRouter()

Router.use('/company', companyRoutes)
Router.use('/job', jobRoutes)

export default Router
