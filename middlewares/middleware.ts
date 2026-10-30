import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import type { Application } from 'express'
import helmet from 'helmet'
import hpp from 'hpp'
import morgan from 'morgan'
import path from 'node:path'

import { isDevelopment } from '../constants/application'
import { rootPath } from '../utils/helper'

const app: Application = express()

// Render sits behind one trusted ingress proxy.
app.set('trust proxy', 1)

// Middleware
app.use(cors({ credentials: true, origin: true }))
app.options('*', cors())

app.use(express.static(path.join(rootPath, 'public'))) // Serving static files

if (isDevelopment) app.use(morgan('dev')) // Development logging

app.use(helmet()) // Set security HTTP headers
app.use(express.json()) // Body parser, convert rawBody into req.body json
app.use(cookieParser()) // Body parser, reading data from cookie
app.use(hpp()) // Prevent parameter pollution
app.use(compression()) // COMPRESS RESPONSE BODY

export default app
