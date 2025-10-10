import { Router as ExpressRouter } from 'express'

import apiController from '../controllers/api.controller'
import adminRoutes from './admin'
import userRoutes from './user'

const Router = ExpressRouter()

Router.route('/self').get(apiController.self)
Router.route('/health').get(apiController.health)

// editor
Router.use('/admin', adminRoutes)

// user
Router.use('/user', userRoutes)
export default Router
