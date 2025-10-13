import type { NextFunction, Request, Response } from 'express'

import responseMessage from './constants/responseMessage'
import globalErrorHandler from './middlewares/globalErrorHandler'
import app from './middlewares/middleware'
import routes from './routes/routes'
import httpError from './utils/httpError'

app.use('/api', routes)

// 404 Handler :  IF NO ROUTES MATCHING ABOVE THAN IT WILL DISPLAY BELOW ROUTE
app.use((req: Request, _: Response, next: NextFunction) => {
  try {
    throw new Error(responseMessage.NOT_FOUND('route'))
  } catch (err) {
    httpError(next, err, req, 404)
  }
})

// Global Error Handler
app.use(globalErrorHandler)

export default app
