/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'

// Default configurations
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg',
  'image/jpg',
  'image/bmp',
  'image/ico',
]

export type ImageType = 'profile' | 'background' | 'cover' | 'favicon'

// Configure multer for handling file uploads
const storage = multer.memoryStorage()

// File filter to only allow images
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = DEFAULT_ALLOWED_TYPES

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
      )
    )
  }
}

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: DEFAULT_MAX_SIZE,
  },
  fileFilter,
}).single('profileImage') // 'profileImage' is the field name in form-data

export const multerValidate = multer({
  storage,
  limits: {
    fileSize: DEFAULT_MAX_SIZE,
  },
  fileFilter,
})

export interface MulterRequest extends Request {
  file?: Express.Multer.File
}

export const multerHandler = async (
  req: MulterRequest,
  res: Response
): Promise<boolean> =>
  new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        reject(err)
      }
      resolve(true)
    })
  })

export interface UploadedImage {
  key: string
  url: string
  name: string
  nameSlug: string
}

// Create multer middleware function
export const createMulterHandler = (
  fieldName: ImageType
): ((req: MulterRequest, res: Response) => Promise<boolean>) => {
  const uploadImgeMiddleware = multer({
    storage,
    limits: {
      fileSize: DEFAULT_MAX_SIZE,
    },
    fileFilter,
  }).single(fieldName)

  return async (req: MulterRequest, res: Response): Promise<boolean> =>
    new Promise((resolve, reject) => {
      uploadImgeMiddleware(req, res, (err) => {
        if (err) {
          reject(err)
        }
        resolve(true)
      })
    })
}

// Create a custom error handler middleware
export const handleMulterError = (
  err: multer.MulterError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    // Handle Multer-specific errors
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          message: `File too large. Maximum size is ${DEFAULT_MAX_SIZE / (1024 * 1024)}MB`,
        })
        break
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          message: 'Unexpected field name in upload',
        })
        break
      default:
        res.status(400).json({
          message: err.message,
        })
        break
    }
  } else if (err) {
    // Handle other errors (like file type)
    res.status(400).json({
      message: err.message,
    })
  }
  next()
}
