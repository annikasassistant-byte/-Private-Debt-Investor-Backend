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

export const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
];

export const resetPasswordValidator = [
  body('token').notEmpty().withMessage('Reset token is required').isString(),
  body('password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain a letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number'),
];

export const verifyEmailValidator = [
  body('token').optional().isString(),
  // Also accept token as query — validated in controller/query fallback
];

export const verifyEmailQueryValidator = [
  body('token')
    .optional()
    .isString(),
];

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
  body('refreshToken')
    .optional()
    .isString()
    .withMessage('Refresh token must be a string'),
  body('deviceId').optional().isString().isLength({ max: 128 }),
  body('deviceName').optional().isString().isLength({ max: 128 }),
];

export default {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  verifyEmailValidator,
  resendVerificationValidator,
  changePasswordValidator,
  refreshTokenValidator,
};
