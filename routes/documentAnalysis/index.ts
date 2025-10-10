import { Router } from 'express'

import documentAnalysisRoutes from './documentAnalysis.route'

const router = Router()

router.use('/documents', documentAnalysisRoutes)

export default router
