import dotenvFlow from 'dotenv-flow'

dotenvFlow.config()

export default {
  // General
  ENV: process.env.ENV as string,
  PORT: process.env.PORT,

  DATABASE_URL: process.env.DATABASE_URL as string,

  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY as string,
  DEFAULT_FROM_EMAIL: process.env.DEFAULT_FROM_EMAIL as string,

  FRONTEND_URL: process.env.FRONTEND_URL as string,

  companyName: 'Softcolon',

  TOKEN_HEADER_NAME: 'authorization',
}
