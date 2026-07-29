import { body, param, query } from 'express-validator';

export const updateProfileValidator = [
  body('firstName').optional().trim().notEmpty().isLength({ max: 100 }),
  body('lastName').optional().trim().notEmpty().isLength({ max: 100 }),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('avatar').optional({ nullable: true }).isString().isLength({ max: 2048 }),
  body('notificationPreferences').optional().isObject(),
  body('notificationPreferences.paymentConfirmations').optional().isBoolean(),
  body('notificationPreferences.upcomingDueDates').optional().isBoolean(),
  body('notificationPreferences.newReports').optional().isBoolean(),
  body('notificationPreferences.platformAnnouncements').optional().isBoolean(),
];

export const notificationPreferencesValidator = [
  body('paymentConfirmations').optional().isBoolean(),
  body('upcomingDueDates').optional().isBoolean(),
  body('newReports').optional().isBoolean(),
  body('platformAnnouncements').optional().isBoolean(),
];

export const listUsersValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isString().isLength({ max: 64 }),
  query('search').optional().isString().isLength({ max: 200 }),
  query('role').optional().isString().isLength({ max: 64 }),
  query('isActive').optional().isIn(['true', 'false', '1', '0', true, false]),
  query('emailVerified').optional().isIn(['true', 'false', '1', '0', true, false]),
];

export const updateUserValidator = [
  param('id').isMongoId().withMessage('Invalid user id'),
  body('firstName').optional().trim().notEmpty().isLength({ max: 100 }),
  body('lastName').optional().trim().notEmpty().isLength({ max: 100 }),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('avatar').optional({ nullable: true }).isString().isLength({ max: 2048 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('emailVerified').optional().isBoolean().toBoolean(),
  body('phoneVerified').optional().isBoolean().toBoolean(),
  body('roleId').optional().isMongoId().withMessage('Invalid role id'),
  body('roleSlug').optional().isString().isLength({ max: 64 }),
  body('role').optional().isMongoId(),
  body('permissions').optional().isArray(),
  body('permissions.*').optional().isMongoId(),
];

export const userIdParamValidator = [param('id').isMongoId().withMessage('Invalid user id')];

export const exportUsersValidator = [
  query('format').optional().isIn(['csv', 'excel', 'xlsx', 'pdf']),
  query('search').optional().isString().isLength({ max: 200 }),
  query('limit').optional().isInt({ min: 1, max: 10000 }).toInt(),
];

export default {
  updateProfileValidator,
  notificationPreferencesValidator,
  listUsersValidator,
  updateUserValidator,
  userIdParamValidator,
  exportUsersValidator,
};
