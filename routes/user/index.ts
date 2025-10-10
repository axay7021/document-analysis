import { Router as ExpressRouter } from 'express'

import jobRoutes from './job.route'

const Router = ExpressRouter()

Router.use('/job', jobRoutes)

export default Router
