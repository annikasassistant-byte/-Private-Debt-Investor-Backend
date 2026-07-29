import { Router } from 'express';
import * as userController from '../../controllers/v1/user.controller.js';
import {
  updateProfileValidator,
  listUsersValidator,
  updateUserValidator,
  userIdParamValidator,
  exportUsersValidator,
} from '../../validators/user.validator.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { uploadAvatar, requireFile } from '../../middlewares/upload.middleware.js';
import { resizeAvatar } from '../../middlewares/imageResize.middleware.js';
import { cacheMiddleware } from '../../middlewares/cache.middleware.js';
import { invalidateUsersCache } from '../../middlewares/cacheInvalidator.middleware.js';
import { uploadLimiter, sensitiveLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { PERMISSIONS } from '../../enums/permissions.js';
import { ROLES } from '../../enums/roles.js';
import { HTTP_CACHE_TTL } from '../../cache/keys.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: User profile and administration
 */

router.use(authenticate);

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  '/me',
  cacheMiddleware({ ttl: HTTP_CACHE_TTL.SHORT, userScoped: true }),
  userController.getMe,
);

/**
 * @openapi
 * /users/me:
 *   patch:
 *     tags: [Users]
 *     summary: Update current user profile
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch(
  '/me',
  invalidateUsersCache,
  updateProfileValidator,
  validate,
  userController.updateMe,
);

/**
 * @openapi
 * /users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Upload avatar
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded
 */
router.post(
  '/me/avatar',
  uploadLimiter,
  uploadAvatar,
  requireFile('avatar'),
  resizeAvatar,
  invalidateUsersCache,
  userController.uploadAvatar,
);

/**
 * @openapi
 * /users/me:
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete own account
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.delete('/me', sensitiveLimiter, invalidateUsersCache, userController.deleteMe);

/**
 * @openapi
 * /users/export:
 *   get:
 *     tags: [Users]
 *     summary: Export users (csv|excel|pdf)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, excel, pdf] }
 *     responses:
 *       200:
 *         description: Export file
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  '/export',
  authorize(ROLES.ADMIN),
  requirePermission(PERMISSIONS.DASHBOARD_EXPORT),
  exportUsersValidator,
  validate,
  userController.exportUsers,
);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated users
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.USER_READ),
  listUsersValidator,
  validate,
  cacheMiddleware({ ttl: HTTP_CACHE_TTL.SHORT }),
  userController.getUsers,
);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.USER_READ),
  userIdParamValidator,
  validate,
  userController.getUser,
);

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Admin update user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User updated
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USER_UPDATE),
  invalidateUsersCache,
  updateUserValidator,
  validate,
  userController.updateUser,
);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USER_DELETE),
  sensitiveLimiter,
  invalidateUsersCache,
  userIdParamValidator,
  validate,
  userController.deleteUser,
);

export default router;
