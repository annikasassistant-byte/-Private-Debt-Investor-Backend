import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import swaggerUi from 'swagger-ui-express';

import env from './config/env.js';
import { helmetOptions } from './config/helmet.js';
import { corsOptions } from './config/cors.js';
import { swaggerSpec, swaggerUiOptions } from './config/swagger.js';
import logger from './config/logger.js';

import {
  requestIdMiddleware,
  requestTimeMiddleware,
  requestLoggerMiddleware,
  generalLimiter,
  xssMiddleware,
  maintenanceMiddleware,
  csrfMiddleware,
  notFoundMiddleware,
  errorMiddleware,
} from './middlewares/index.js';

import routes from './routes/index.js';
import { getStatusPayload, renderStatusPage } from './views/statusPage.js';

/**
 * Build and configure the Express application.
 * @returns {import('express').Application}
 */
export function createExpressApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---- Early request metadata ----
  app.use(requestIdMiddleware);
  app.use(requestTimeMiddleware);

  // ---- Security & cross-cutting ----
  app.use(helmet(helmetOptions));
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(generalLimiter);

  // ---- Body / cookies ----
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // ---- Sanitization ----
  app.use(
    mongoSanitize({
      replaceWith: '_',
      allowDots: true,
    }),
  );
  app.use(hpp());
  app.use(xssMiddleware);

  // ---- Logging ----
  app.use(requestLoggerMiddleware);

  // ---- Maintenance / CSRF ----
  app.use(maintenanceMiddleware);
  app.use(csrfMiddleware);

  // ---- Static uploads ----
  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), {
      maxAge: env.NODE_ENV === 'production' ? '1d' : 0,
      fallthrough: true,
    }),
  );

  // Status page assets (spinner boot script) — does not affect API routes
  const statusAssetsDir = path.resolve(
    process.cwd(),
    process.env.STATUS_ASSETS_DIR || 'src/public',
  );
  app.use(
    '/status-assets',
    express.static(statusAssetsDir, {
      maxAge: env.NODE_ENV === 'production' ? '1h' : 0,
      fallthrough: true,
    }),
  );

  // ---- Swagger docs ----
  if (env.SWAGGER_ENABLED) {
    const docsPath = env.SWAGGER_PATH || '/api/docs';
    app.use(docsPath, swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    // Alias requested path
    if (docsPath !== '/api/docs') {
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    }
    app.get('/api/docs.json', (_req, res) => {
      res.json(swaggerSpec);
    });
    logger.info(`Swagger docs available at ${docsPath} and /api/docs`);
  }

  // ---- API routes ----
  app.use(routes);

  // Depth Capital status UI at `/` — JSON still available via ?format=json / Accept
  app.get('/', (req, res) => {
    const wantsJson =
      req.query.format === 'json' ||
      (typeof req.headers.accept === 'string' &&
        req.headers.accept.includes('application/json') &&
        !req.headers.accept.includes('text/html'));

    if (wantsJson) {
      return res.json(getStatusPayload());
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderStatusPage());
  });

  // ---- 404 & errors ----
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export default createExpressApp;
