export interface THttpResponse {
  success: boolean
  statusCode: number
  request: {
    ip?: string | null
    method: string
    url: string
  }
  message: string
  data: unknown
}

export interface THttpError {
  success: boolean
  statusCode: number
  request: {
    ip?: string | null
    method: string
    url: string
  }
  message: string
  data: unknown
  trace?: object | null
}
