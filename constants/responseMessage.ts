export const HTTP_STATUSES = {
  SUCCESS: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_VERIFIED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PAYLOAD_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

const EMAIL_MESSAGES = {
  WELCOME_SUBJECT: 'Welcome to Job Insider',
  RESET_PASSWORD_SUBJECT: 'Reset Your Password',
  CHANGE_PASSWORD_SUBJECT: 'Password Changed Successfully',
  MAIL_SENT: 'Email sent successfully',
  MAIL_INVALID: 'Invalid email address',
  MAIL_SUCCESS: 'Email sent successfully',
  MAIL_FAILED: 'Failed to send email',
  NO_EMAIL_TEMPLATE_FOUND: 'Email template not found',
  MAIL_SENT_MESSAGE: 'Email has been sent to your registered email address',
  VERIFICATION_MAIL_SENT_MESSAGE:
    'Verification email has been sent to your registered email address',
} as const

const API_MESSAGES = {
  REGISTER_MESSAGE: 'User registered successfully',
  LOGIN_MESSAGE: 'User logged in successfully',
  FORGOT_PASSWORD_MESSAGE: 'Password reset instructions sent to your email',
  RESET_PASSWORD_MESSAGE: 'Password reset successfully',
  ACCOUNT_VERIFIED_MESSAGE: 'Account verified successfully',
  CHANGE_PASSWORD_MESSAGE: 'Password changed successfully',
  LOGOUT_MESSAGE: 'User logged out successfully',
} as const

const MESSAGES = {
  INVALID_DATA: 'Invalid data provided',
  NO_DATA_FOUND: 'No data found',
  ID_NOT_FOUND: 'ID not found',
  INCORRECT_LOGIN: 'Incorrect email or password',
  ALREADY_EXIST: (entity: string): string => `${entity} already exists`,
  ALREADY_VERIFIED: 'Already verified',
  NOT_VERIFIED: 'Not verified',
  NOT_ACTIVATED: 'Account not activated',
  PERMISSION_ALREADY_EXIST: 'Permission already exists',
  PASSWORD_WRONG: 'Incorrect password',
  SAME_PASSWORD: 'New password must be different from current password',
  INVALID_ROLE: 'Invalid role',
  SITE_HANDSHAKE: 'Site handshake successful',
  API_HANDSHAKE: 'API handshake successful',
  FRONT_HANDSHAKE: 'Frontend handshake successful',
  CMS_HANDSHAKE: 'CMS handshake successful',
  ROLE_DELETE_NOT_ALLOWED: 'Role deletion not allowed',
  PROVIDE_VALID_OBJECT_ID: 'Please provide a valid Object ID',
  UPLOAD_FILE: 'Please upload a file',
  INVALID_FILE: 'Invalid file format',
  REFERRAL_USER_ALREADY_EXIST: 'Referral user already exists',
  NOT_ALLOWED_TO_GO_BACKWARD: 'Not allowed to go backward',
}

const ERRORS = {
  SOMETHING_WENT_WRONG: 'An error occurred!',
  UNKNOWN_ERROR: 'An unknown error occurred',
  TECHNICAL_ERROR: 'A technical error occurred',
  EMAIL_ERROR: 'Email service error',
  S3_ERROR: 'File storage error',
  FORBIDDEN_ERROR: 'Access forbidden',
  UNAUTHORIZED_ERROR: 'Unauthorized access',
  TOKEN_NOT_EXIST_ERROR: 'Token does not exist',
  INVALID_TOKEN_ERROR: 'Invalid token',
  TOKEN_EXPIRED_ERROR: 'Token has expired',
  EXPIRED_TOKEN_ERROR: 'Token has expired',
  PASSWORD_CHANGED_ERROR: 'Password has been changed',
  RATE_LIMIT_ERROR: 'Rate limit exceeded',
  MAINTENANCE_ERROR: 'Service under maintenance',
  JSON_PARSE_ERROR: 'Invalid JSON format',
}

const FUNCTIONS = {
  ROUTE_NOT_FOUND: (url: string): string => `Route not found: ${url}`,
  FORMAT: (prefix: string): string => prefix.toUpperCase().replace(/\s/g, '_'),
}

const CRUD_MESSAGES = {
  SUCCESS: 'Operation completed successfully',
  DATA_CREATED: (prefix: string): string => `${prefix} created successfully`,
  DATA_RETRIEVED: (prefix: string): string =>
    `${prefix} retrieved successfully`,
  DATA_UPDATED: (prefix: string): string => `${prefix} updated successfully`,
  DATA_DELETED: (prefix: string): string => `${prefix} deleted successfully`,
}

const OTHERS = {
  PER_PAGE_LIMIT: 10,
}

export default {
  NOT_FOUND: (entity: string): string => `${entity} not found`,
  TOO_MANY_REQUESTS: `Too many requests! Please try again later`,
  INVALID_REQUEST: (entity: string): string => `Invalid ${entity} request`,

  validation: {
    required: '{#label} is required',
    email: 'Please enter a valid email address',
    min: '{#label} must be at least {#limit} characters',
    max: '{#label} must be at most {#limit} characters',
    tokenRequired: 'Token is required',
    otpRequired: 'OTP is required',
    invalidBoolean: 'Invalid boolean value',
  },

  FILE_REQUIRED: 'File is required',

  ...EMAIL_MESSAGES,
  ...API_MESSAGES,
  ...MESSAGES,
  ...ERRORS,
  ...FUNCTIONS,
  ...CRUD_MESSAGES,
  ...OTHERS,
}
