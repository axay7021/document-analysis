/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { blue, green, magenta, red, yellow } from 'colorette'
import fs from 'fs'
import path from 'path'
import * as sourceMapSupport from 'source-map-support'
import { inspect } from 'util'
import { createLogger, format, transports } from 'winston'
import 'winston-daily-rotate-file'
import type {
  ConsoleTransportInstance,
  FileTransportInstance,
} from 'winston/lib/winston/transports'

import config from '../config'

// Linking Trace Support
sourceMapSupport.install()

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../', '../', 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const colorizeLevel = (level: string) => {
  switch (level) {
    case 'ERROR':
      return red(level)
    case 'INFO':
      return blue(level)
    case 'WARN':
      return yellow(level)
    default:
      return level
  }
}

const consoleLogFormat = format.printf((info) => {
  const { level, message, timestamp, meta = {} } = info

  const customLevel = colorizeLevel(level.toUpperCase())

  const customTimestamp = green(timestamp as string)

  const customMessage = message

  const customMeta = inspect(meta, {
    showHidden: false,
    depth: null,
    colors: true,
  })

  const customLog = `${customLevel} [${customTimestamp}] ${customMessage}\n${magenta('META')} ${customMeta}\n`

  return customLog
})

const consoleTransport = (): ConsoleTransportInstance[] => [
  new transports.Console({
    level: 'info',
    format: format.combine(format.timestamp(), consoleLogFormat),
  }),
]

const fileLogFormat = format.printf((info) => {
  const { level, message, timestamp, meta = {} } = info

  const logMeta: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      logMeta[key] = {
        name: value.name,
        message: value.message,
        trace: value.stack || '',
      }
    } else {
      logMeta[key] = value
    }
  }

  const logData = {
    level: level.toUpperCase(),

    message,

    timestamp,
    meta: logMeta,
  }

  return JSON.stringify(logData, null, 4)
})

// Date-wise Log Rotation
const DailyRotateFileTransport = () =>
  new transports.DailyRotateFile({
    filename: path.join(logsDir, `%DATE%_${config.ENV}.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info',
    format: format.combine(format.timestamp(), fileLogFormat),
  })

// Legacy file transport (keeping for backward compatibility)
const FileTransport = (): FileTransportInstance[] => [
  new transports.File({
    filename: path.join(logsDir, `${config.ENV}.log`),
    level: 'info',
    format: format.combine(format.timestamp(), fileLogFormat),
  }),
]

export default createLogger({
  defaultMeta: {
    meta: {},
  },
  transports: [
    // Daily rotating file logs
    DailyRotateFileTransport(),
    // Legacy single file log (can be removed if not needed)
    ...FileTransport(),
    // Console transport for development
    ...consoleTransport(),
    // Add CloudWatch transport if it exists (only in production)
  ],
})
