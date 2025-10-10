export interface IDocument {
  id: string
  name: string
  type: 'pdf' | 'text'
  originalName: string
  filePath: string
  size: number
  uploadedAt: Date
  userId?: string
  metadata: {
    title?: string
    author?: string
    subject?: string
    language?: string
    tags?: string[]
    category?: string
    [key: string]: unknown
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IDocumentMethods {
  // Add any instance methods here
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IDocumentModel {
  // Add any static methods here
}
