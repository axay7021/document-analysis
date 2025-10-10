/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import config from '../config'

export enum EApplicationEnvironment {
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
}

export const isDevelopment = config.ENV === EApplicationEnvironment.DEVELOPMENT
