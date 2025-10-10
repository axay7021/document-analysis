import type { Request, Response } from 'express'

import responseMessage from '../constants/responseMessage'
import globalHandler from '../utils/globalHandler'
import httpResponse from '../utils/httpResponse'
import quicker from '../utils/quicker'

export default {
  self: globalHandler((req: Request, res: Response) => {
    httpResponse(req, res, 200, responseMessage.SUCCESS)
  }),

  health: globalHandler((req: Request, res: Response) => {
    const healthData = {
      application: quicker.getApplicationHealth(),
      system: quicker.getSystemHealth(),
      timestamp: Date.now(),
    }

    httpResponse(req, res, 200, responseMessage.SUCCESS, healthData)
  }),
}
