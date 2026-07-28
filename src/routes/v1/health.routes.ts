import { Router } from 'express';
import * as healthController from '../../controllers/v1/health.controller.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Health
 *     description: Service health checks
 */

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Combined health / liveness
 *     parameters:
 *       - in: query
 *         name: ready
 *         schema: { type: string, enum: ['1', 'true'] }
 *         description: When set, runs readiness checks
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       503:
 *         description: Service degraded
 */
router.get('/', healthController.health);

/**
 * @openapi
 * /health/live:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     responses:
 *       200:
 *         description: Process is up
 */
router.get('/live', healthController.live);

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe
 *     responses:
 *       200:
 *         description: Dependencies ready
 *       503:
 *         description: Dependencies not ready
 */
router.get('/ready', healthController.ready);

export default router;
