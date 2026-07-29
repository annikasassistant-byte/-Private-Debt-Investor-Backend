import { Router } from 'express';
import * as roleController from '../../controllers/v1/role.controller.js';
import {
  createRoleValidator,
  updateRoleValidator,
  roleIdParamValidator,
  listRolesValidator,
  assignPermissionsValidator,
} from '../../validators/role.validator.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { cacheMiddleware } from '../../middlewares/cache.middleware.js';
import { invalidateRolesCache } from '../../middlewares/cacheInvalidator.middleware.js';
import { ROLES } from '../../enums/roles.js';
import { PERMISSIONS } from '../../enums/permissions.js';
import { HTTP_CACHE_TTL } from '../../cache/keys.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Roles
 *     description: Role management
 */

router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

/**
 * @openapi
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: List roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated roles
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.USER_MANAGE_ROLES),
  listRolesValidator,
  validate,
  cacheMiddleware({ ttl: HTTP_CACHE_TTL.MEDIUM }),
  roleController.getRoles,
);

/**
 * @openapi
 * /roles:
 *   post:
 *     tags: [Roles]
 *     summary: Create role
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               permissions:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: Role created
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.USER_MANAGE_ROLES),
  invalidateRolesCache,
  createRoleValidator,
  validate,
  roleController.createRole,
);

/**
 * @openapi
 * /roles/{id}:
 *   get:
 *     tags: [Roles]
 *     summary: Get role by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.USER_MANAGE_ROLES),
  roleIdParamValidator,
  validate,
  roleController.getRole,
);

/**
 * @openapi
 * /roles/{id}:
 *   patch:
 *     tags: [Roles]
 *     summary: Update role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role updated
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USER_MANAGE_ROLES),
  invalidateRolesCache,
  updateRoleValidator,
  validate,
  roleController.updateRole,
);

/**
 * @openapi
 * /roles/{id}:
 *   delete:
 *     tags: [Roles]
 *     summary: Soft-delete role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role deleted
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USER_MANAGE_ROLES),
  invalidateRolesCache,
  roleIdParamValidator,
  validate,
  roleController.deleteRole,
);

/**
 * @openapi
 * /roles/{id}/permissions:
 *   put:
 *     tags: [Roles]
 *     summary: Assign permissions to role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Permissions assigned
 */
router.put(
  '/:id/permissions',
  requirePermission(PERMISSIONS.USER_MANAGE_ROLES),
  invalidateRolesCache,
  assignPermissionsValidator,
  validate,
  roleController.assignPermissions,
);

export default router;
