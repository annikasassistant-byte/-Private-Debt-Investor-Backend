import { Router } from 'express';
import * as permissionController from '../../controllers/v1/permission.controller.js';
import {
  createPermissionValidator,
  updatePermissionValidator,
  permissionIdParamValidator,
  listPermissionsValidator,
} from '../../validators/permission.validator.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { cacheMiddleware } from '../../middlewares/cache.middleware.js';
import { invalidatePermissionsCache } from '../../middlewares/cacheInvalidator.middleware.js';
import { ROLES } from '../../enums/roles.js';
import { PERMISSIONS } from '../../enums/permissions.js';
import { HTTP_CACHE_TTL } from '../../cache/keys.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Permissions
 *     description: Permission catalog management
 */

router.use(authenticate);
router.use(authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN));

/**
 * @openapi
 * /permissions:
 *   get:
 *     tags: [Permissions]
 *     summary: List permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated permissions
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  listPermissionsValidator,
  validate,
  cacheMiddleware({ ttl: HTTP_CACHE_TTL.MEDIUM }),
  permissionController.getPermissions,
);

/**
 * @openapi
 * /permissions:
 *   post:
 *     tags: [Permissions]
 *     summary: Create permission
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resource, action]
 *             properties:
 *               resource: { type: string }
 *               action: { type: string }
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Permission created
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  invalidatePermissionsCache,
  createPermissionValidator,
  validate,
  permissionController.createPermission,
);

/**
 * @openapi
 * /permissions/{id}:
 *   get:
 *     tags: [Permissions]
 *     summary: Get permission by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  permissionIdParamValidator,
  validate,
  permissionController.getPermission,
);

/**
 * @openapi
 * /permissions/{id}:
 *   patch:
 *     tags: [Permissions]
 *     summary: Update permission
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission updated
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  invalidatePermissionsCache,
  updatePermissionValidator,
  validate,
  permissionController.updatePermission,
);

/**
 * @openapi
 * /permissions/{id}:
 *   delete:
 *     tags: [Permissions]
 *     summary: Soft-delete permission
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission deleted
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  invalidatePermissionsCache,
  permissionIdParamValidator,
  validate,
  permissionController.deletePermission,
);

export default router;
