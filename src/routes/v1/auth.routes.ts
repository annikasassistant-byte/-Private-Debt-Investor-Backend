import { Router } from 'express';
import * as authController from '../../controllers/v1/auth.controller.js';
import {
  registerValidator,
  loginValidator,
  registerAdminValidator,
  forgotPasswordValidator,
  verifyOtpValidator,
  resetPasswordValidator,
  changePasswordValidator,
  refreshTokenValidator,
  resendVerificationValidator,
} from '../../validators/auth.validator.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { apiKeyMiddleware } from '../../middlewares/apiKey.middleware.js';
import { authLimiter, sensitiveLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication & session management
 */

router.post('/register', authLimiter, registerValidator, validate, authController.register);

/**
 * @openapi
 * /auth/register-admin:
 *   post:
 *     tags: [Auth]
 *     summary: Bootstrap platform admin (equivalent to npm run create-admin)
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               force: { type: boolean, description: Reset password if admin already exists }
 *     responses:
 *       201:
 *         description: Admin created
 *       200:
 *         description: Admin updated (force) or already existed
 */
router.post(
  '/register-admin',
  sensitiveLimiter,
  apiKeyMiddleware,
  registerAdminValidator,
  validate,
  authController.registerAdmin,
);

router.post('/login', authLimiter, loginValidator, validate, authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, sensitiveLimiter, authController.logoutAll);
router.post('/refresh', authLimiter, refreshTokenValidator, validate, authController.refresh);

router.post(
  '/forgot-password',
  authLimiter,
  forgotPasswordValidator,
  validate,
  authController.forgotPassword,
);

/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify password-reset OTP and receive a reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string }
 *     responses:
 *       200:
 *         description: OTP verified; resetToken returned
 *       400: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/verify-otp', authLimiter, verifyOtpValidator, validate, authController.verifyOtp);

router.post(
  '/reset-password',
  authLimiter,
  resetPasswordValidator,
  validate,
  authController.resetPassword,
);

router.post('/verify-email', authLimiter, authController.verifyEmail);

router.post(
  '/resend-verification',
  authLimiter,
  resendVerificationValidator,
  validate,
  authController.resendVerification,
);

router.post(
  '/change-password',
  authenticate,
  sensitiveLimiter,
  changePasswordValidator,
  validate,
  authController.changePassword,
);

export default router;
