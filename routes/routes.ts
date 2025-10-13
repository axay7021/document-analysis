import { Router as ExpressRouter } from 'express'

import apiController from '../controllers/api.controller'
import v1Routes from './v1.routes'

const Router = ExpressRouter()

// Legacy routes (keep for backwards compatibility)
Router.route('/self').get(apiController.self)
Router.route('/health').get(apiController.health)
Router.use('/v1', v1Routes)

export default Router
