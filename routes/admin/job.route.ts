import { Router as ExpressRouter } from 'express'

import {
  createJob,
  getJobById,
  getJobs,
} from '../../controllers/job.controller'
import { createJobSchema } from '../../schemas/job.schema'
import { validate } from '../../utils/validate'

const Router = ExpressRouter()

Router.get('/get-jobs', getJobs)
Router.post('/create-job', validate(createJobSchema), createJob)
Router.get('/get-job/:id', getJobById)

export default Router
