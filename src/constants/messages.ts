export const MESSAGES = Object.freeze({
  SUCCESS: 'Request completed successfully',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  FETCHED: 'Resource fetched successfully',
  LIST_FETCHED: 'Resources fetched successfully',

  VALIDATION_FAILED: 'Validation failed',
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource already exists',
  TOO_MANY_REQUESTS: 'Too many requests, please try again later',
  INTERNAL_ERROR: 'An unexpected error occurred',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  MAINTENANCE: 'The application is currently under maintenance',

  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Token is invalid',
  TOKEN_MISSING: 'Authentication token is missing',
  REFRESH_TOKEN_INVALID: 'Refresh token is invalid or expired',

  ACCOUNT_LOCKED: 'Account is temporarily locked due to too many failed attempts',
  ACCOUNT_DISABLED: 'Account has been disabled',
  ACCOUNT_NOT_VERIFIED: 'Please verify your email address',
  EMAIL_ALREADY_VERIFIED: 'Email is already verified',
  PASSWORD_RESET_SENT: 'Password reset instructions have been sent',
  PASSWORD_CHANGED: 'Password changed successfully',
  EMAIL_SENT: 'Email sent successfully',

  UPLOAD_SUCCESS: 'File uploaded successfully',
  UPLOAD_FAILED: 'File upload failed',
  FILE_TOO_LARGE: 'File size exceeds the allowed limit',
  INVALID_FILE_TYPE: 'Invalid file type',

  DATABASE_ERROR: 'Database operation failed',
  REDIS_ERROR: 'Cache operation failed',
  MAIL_ERROR: 'Failed to send email',
});

export default MESSAGES;
