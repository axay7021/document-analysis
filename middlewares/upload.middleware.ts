import type { Request } from 'express'
import multer from 'multer'
import path from 'path'

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents') // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix =
      Date.now().toString() + '-' + Math.round(Math.random() * 1e9).toString()
    const ext = path.extname(file.originalname)
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  },
})

// File filter for allowed types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ['.pdf', '.txt', '.md']
  const fileExt = path.extname(file.originalname).toLowerCase()

  if (allowedTypes.includes(fileExt)) {
    cb(null, true)
  } else {
    cb(
      new Error(
        `File type ${fileExt} not allowed. Only PDF, TXT, and MD files are supported.`
      )
    )
  }
}

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // Allow up to 10 files
  },
})

// Export middleware functions
export const uploadSingle = upload.single('document')
export const uploadMultiple = upload.array('documents', 10) // Max 10 files (consistent with limits)
export const uploadFields = upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'metadata', maxCount: 1 },
])

// Export upload instance for custom configurations if needed
export { upload }

// Type for uploaded file with additional properties
export interface UploadedFile extends Express.Multer.File {
  id?: string
}
