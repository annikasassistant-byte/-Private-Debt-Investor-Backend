import { body } from 'express-validator';

const passwordRule = body('password')
  .isString()
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be 8-128 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must contain a letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain a number');

export const registerValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  passwordRule,
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 100 })
    .withMessage('First name is too long'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 100 })
    .withMessage('Last name is too long'),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('roleSlug').optional().isString().isLength({ max: 64 }),
  body('roleId').optional().isMongoId().withMessage('Invalid role id'),
];

export const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  body('deviceId').optional().isString().isLength({ max: 128 }),
  body('deviceName').optional().isString().isLength({ max: 128 }),
];

/** Bootstrap platform admin (same as npm run create-admin). Requires X-API-Key. */
export const registerAdminValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  passwordRule,
  body('firstName').optional().trim().isLength({ max: 100 }),
  body('lastName').optional().trim().isLength({ max: 100 }),
  body('force').optional().isBoolean().toBoolean(),
  body('roleSlug').optional().isString().isLength({ max: 64 }),
];

export const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
];

export const resetPasswordValidator = [
  body('password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain a letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number'),
  body('token').optional().isString(),
  body('resetToken').optional().isString(),
  body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp').optional().isString().isLength({ min: 4, max: 12 }),
  body().custom((value) => {
    if (value.token || value.resetToken || (value.email && value.otp)) {
      return true;
    }
    throw new Error('Reset token or email + OTP is required');
  }),
];

export const verifyOtpValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp')
    .isString()
    .isLength({ min: 4, max: 12 })
    .withMessage('OTP is required')
    .matches(/^\d+$/)
    .withMessage('OTP must be numeric'),
];

export const verifyEmailValidator = [
  body('token').optional().isString(),
  // Also accept token as query — validated in controller/query fallback
];

export const verifyEmailQueryValidator = [body('token').optional().isString()];

export const resendVerificationValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be 8-128 characters')
    .matches(/[A-Za-z]/)
    .withMessage('New password must contain a letter')
    .matches(/[0-9]/)
    .withMessage('New password must contain a number')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
];

export const refreshTokenValidator = [
  body('refreshToken').optional().isString().withMessage('Refresh token must be a string'),
  body('deviceId').optional().isString().isLength({ max: 128 }),
  body('deviceName').optional().isString().isLength({ max: 128 }),
];

export default {
  registerValidator,
  loginValidator,
  registerAdminValidator,
  forgotPasswordValidator,
  verifyOtpValidator,
  resetPasswordValidator,
  verifyEmailValidator,
  resendVerificationValidator,
  changePasswordValidator,
  refreshTokenValidator,
};
