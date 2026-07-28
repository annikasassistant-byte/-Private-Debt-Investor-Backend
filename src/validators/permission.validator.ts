import { body, param, query } from 'express-validator';

export const createPermissionValidator = [
  body('resource')
    .trim()
    .notEmpty()
    .withMessage('resource is required')
    .isLength({ max: 64 })
    .matches(/^[a-z0-9_-]+$/i),
  body('action')
    .trim()
    .notEmpty()
    .withMessage('action is required')
    .isLength({ max: 64 })
    .matches(/^[a-z0-9_-]+$/i),
  body('name').optional().trim().isLength({ max: 120 }),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9_:-]+$/i)
    .withMessage('Invalid slug format'),
  body('description').optional().isString().isLength({ max: 500 }),
];

export const updatePermissionValidator = [
  param('id').isMongoId().withMessage('Invalid permission id'),
  body('resource').optional().trim().notEmpty().isLength({ max: 64 }),
  body('action').optional().trim().notEmpty().isLength({ max: 64 }),
  body('name').optional().trim().isLength({ max: 120 }),
  body('slug').optional().trim().isLength({ max: 128 }),
  body('description').optional().isString().isLength({ max: 500 }),
];

export const permissionIdParamValidator = [
  param('id').isMongoId().withMessage('Invalid permission id'),
];

export const listPermissionsValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isString().isLength({ max: 64 }),
  query('search').optional().isString().isLength({ max: 200 }),
  query('resource').optional().isString().isLength({ max: 64 }),
  query('action').optional().isString().isLength({ max: 64 }),
];

export default {
  createPermissionValidator,
  updatePermissionValidator,
  permissionIdParamValidator,
  listPermissionsValidator,
};
