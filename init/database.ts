import mongoose from 'mongoose'
import type { Connection } from 'mongoose'

import config from '../config'
import logger from '../utils/logger'

const { DATABASE_URL, ENV } = config

if (ENV === 'production' && !DATABASE_URL) {
  logger.error('THIS COMMAND IS NOT MADE FOR DEVELOPMENT')
  logger.error('SERVER ERROR - ENV NOT FOUND')
  process.exit(0)
}

const mongooseInit = async (): Promise<Connection['db']> => {
  const res = await mongoose.connect(DATABASE_URL)
  return res.connection.db
}

export default mongooseInit
