import { Router as ExpressRouter } from 'express'

import { getJobById, getJobs } from '../../controllers/job.controller'

const Router = ExpressRouter()

Router.get('/get-jobs', getJobs)
Router.get('/get-job/:id', getJobById)

export default Router
