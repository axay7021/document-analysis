import { Router as ExpressRouter } from 'express'

import apiController from '../controllers/api.controller'
import documentAnalysisRoutes from './documentAnalysis'

const Router = ExpressRouter()

Router.route('/self').get(apiController.self)
Router.route('/health').get(apiController.health)

// Document Analysis POC
Router.use('/analysis', documentAnalysisRoutes)

export default Router
