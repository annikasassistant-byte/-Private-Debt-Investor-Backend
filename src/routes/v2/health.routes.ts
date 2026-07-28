import { Router } from 'express';
import * as healthController from '../../controllers/v2/health.controller.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: API v2 health check
 *     description: Versioning example endpoint
 *     responses:
 *       200:
 *         description: v2 health payload
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 */
router.get('/health', healthController.health);

export default router;
