/**
 * Additional OpenAPI path definitions for Swagger.
 * Prefer JSDoc on route files when available; this module fills gaps
 * for health / auth stubs until routes are fully annotated.
 */

export const swaggerPaths = {
  '/health': {
    get: {
      tags: ['Health'],
      summary: 'Liveness probe',
      description: 'Returns 200 when the process is up.',
      responses: {
        200: {
          description: 'Service is alive',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OK' },
                  data: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      uptime: { type: 'number' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/health/ready': {
    get: {
      tags: ['Health'],
      summary: 'Readiness probe',
      description: 'Checks MongoDB (and optionally Redis) connectivity.',
      responses: {
        200: { description: 'Ready to accept traffic' },
        503: { description: 'Dependencies unavailable' },
      },
    },
  },
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password', 'firstName', 'lastName'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'User registered' },
        400: { $ref: '#/components/responses/ValidationError' },
        409: { description: 'Email already in use' },
      },
    },
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login with email and password',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' },
                deviceId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Authenticated' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/TooManyRequests' },
      },
    },
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      responses: {
        200: { description: 'Tokens rotated' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout and revoke refresh token',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        200: { description: 'Logged out' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
};

/**
 * Merge path defs into an existing OpenAPI document.
 * @param {object} spec
 * @returns {object}
 */
export function mergeSwaggerPaths(spec = {}) {
  return {
    ...spec,
    paths: {
      ...(spec.paths || {}),
      ...swaggerPaths,
    },
  };
}

export default swaggerPaths;
