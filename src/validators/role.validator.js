import { body, param, query } from 'express-validator';

export const createRoleValidator = [
  body('name').trim().notEmpty().withMessage('Role name is required').isLength({ max: 100 }),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9_-]+$/)
    .withMessage('Slug must be lowercase alphanumeric with hyphens/underscores'),
  body('description').optional().isString().isLength({ max: 500 }),
  body('permissions').optional().isArray(),
  body('permissions.*').optional().isMongoId(),
  body('permissionSlugs').optional().isArray(),
  body('permissionSlugs.*').optional().isString(),
  body('isSystem').optional().isBoolean().toBoolean(),
  body('isActive').optional().isBoolean().toBoolean(),
];

export const updateRoleValidator = [
  param('id').isMongoId().withMessage('Invalid role id'),
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9_-]+$/)
    .withMessage('Slug must be lowercase alphanumeric with hyphens/underscores'),
  body('description').optional().isString().isLength({ max: 500 }),
  body('permissions').optional().isArray(),
  body('permissions.*').optional().isMongoId(),
  body('isActive').optional().isBoolean().toBoolean(),
];

export const roleIdParamValidator = [
  param('id').isMongoId().withMessage('Invalid role id'),
];

export const listRolesValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isString().isLength({ max: 64 }),
  query('search').optional().isString().isLength({ max: 200 }),
  query('isActive').optional().isIn(['true', 'false', '1', '0', true, false]),
];

export const assignPermissionsValidator = [
  param('id').isMongoId().withMessage('Invalid role id'),
  body('permissions').isArray({ min: 1 }).withMessage('permissions array is required'),
];

export default {
  createRoleValidator,
  updateRoleValidator,
  roleIdParamValidator,
  listRolesValidator,
  assignPermissionsValidator,
};
