import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// App config then credentials (URL-only secrets in .env.server override .env)
dotenv.config({ path: path.join(rootDir, '.env') });
console.log('***********env.ts***********');
console.log(process.env.NODE_ENV);

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.join(rootDir, '.env.server'), override: true });
} else {
  dotenv.config({ path: path.join(rootDir, '.env.example'), override: true });
}
console.log('***********env.ts***********');

const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    return val === 'true' || val === '1';
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('Depth Dashboard API'),
  APP_VERSION: z.string().default('1.0.0'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  MAINTENANCE_MODE: booleanFromString.default(false),
  API_KEY: z.string().min(8).default('change-me-api-key'),

  // --- URL-only integrations ---
  /** MongoDB Atlas: mongodb+srv://USER:PASS@CLUSTER.mongodb.net/db?... */
  MONGODB_URI: z.string().min(1),
  /** Redis / Redis Cloud / Upstash: redis://... or rediss://... (password in URL) */
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  /** Cloudinary: cloudinary://API_KEY:API_SECRET@CLOUD_NAME */
  CLOUDINARY_URL: z.string().optional().default(''),

  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().default(10),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().int().nonnegative().default(2),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  MONGODB_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  MONGODB_RETRY_DELAY_MS: z.coerce.number().int().positive().default(3000),
  MONGODB_AUTO_INDEX: booleanFromString.default(true),
  MONGODB_FAMILY: z.coerce.number().int().optional(),

  REDIS_KEY_PREFIX: z.string().default('depth:'),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  REDIS_MAX_RETRIES: z.coerce.number().int().nonnegative().default(10),
  REDIS_ENABLE_OFFLINE_QUEUE: booleanFromString.default(true),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  JWT_ISSUER: z.string().default('depth-dashboard'),
  JWT_AUDIENCE: z.string().default('depth-dashboard-client'),

  COOKIE_SECRET: z.string().min(32),
  COOKIE_SECURE: booleanFromString.default(false),
  COOKIE_HTTP_ONLY: booleanFromString.default(true),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_PATH: z.string().default('/'),
  COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(604800000),
  ACCESS_COOKIE_NAME: z.string().default('access_token'),
  REFRESH_COOKIE_NAME: z.string().default('refresh_token'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  ACCOUNT_LOCK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ACCOUNT_LOCK_DURATION_MS: z.coerce.number().int().positive().default(900000),
  PASSWORD_RESET_EXPIRES_MS: z.coerce.number().int().positive().default(3600000),
  EMAIL_VERIFY_EXPIRES_MS: z.coerce.number().int().positive().default(86400000),
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_EXPIRES_MS: z.coerce.number().int().positive().default(600000),

  SMTP_HOST: z.string().default('smtp.mailtrap.io'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromString.default(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM_NAME: z.string().default('Depth Dashboard'),
  SMTP_FROM_EMAIL: z.string().email().default('noreply@depthdashboard.com'),

  CLOUDINARY_FOLDER: z.string().default('depth-dashboard'),
  CLOUDINARY_SECURE: booleanFromString.default(true),

  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional().default(''),
  AWS_S3_ENDPOINT: z.string().optional().default(''),
  AWS_S3_FORCE_PATH_STYLE: booleanFromString.default(false),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_UPLOAD_WINDOW_MS: z.coerce.number().int().positive().default(3600000),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(50),
  RATE_LIMIT_SKIP_SUCCESSFUL: booleanFromString.default(false),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: booleanFromString.default(true),
  CORS_METHODS: z.string().default('GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'),
  CORS_ALLOWED_HEADERS: z
    .string()
    .default(
      'Content-Type,Authorization,X-Requested-With,X-API-Key,Accept,X-Device-Id,X-Device-Name,X-CSRF-Token',
    ),
  CORS_EXPOSED_HEADERS: z.string().default('X-Total-Count,X-Page,X-Limit,Content-Disposition'),
  CORS_MAX_AGE: z.coerce.number().int().nonnegative().default(86400),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_DIR: z.string().default('logs'),
  LOG_MAX_SIZE: z.string().default('20m'),
  LOG_MAX_FILES: z.string().default('14d'),
  LOG_DATE_PATTERN: z.string().default('YYYY-MM-DD'),

  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive().default(5),
  UPLOAD_ALLOWED_MIME: z
    .string()
    .default('image/jpeg,image/png,image/webp,image/gif,application/pdf'),

  SWAGGER_ENABLED: booleanFromString.default(true),
  SWAGGER_PATH: z.string().default('/api-docs'),
  SWAGGER_TITLE: z.string().default('Depth Dashboard API'),
  SWAGGER_DESCRIPTION: z.string().default('REST API documentation for Depth Dashboard'),
  SWAGGER_CONTACT_EMAIL: z.string().email().default('dev@depthdashboard.com'),

  PAGINATION_DEFAULT_PAGE: z.coerce.number().int().positive().default(1),
  PAGINATION_DEFAULT_LIMIT: z.coerce.number().int().positive().default(20),
  PAGINATION_MAX_LIMIT: z.coerce.number().int().positive().default(100),

  QUEUE_PREFIX: z.string().default('depth-queue'),
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  QUEUE_ATTEMPTS: z.coerce.number().int().positive().default(3),
  QUEUE_BACKOFF_MS: z.coerce.number().int().positive().default(5000),

  SOCKET_PATH: z.string().default('/socket.io'),
  SOCKET_CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SOCKET_PING_TIMEOUT: z.coerce.number().int().positive().default(60000),
  SOCKET_PING_INTERVAL: z.coerce.number().int().positive().default(25000),

  /**
   * Weekend/holiday due-date policy:
   * - next_business_day (default): move Sat/Sun/holiday to next business day
   * - keep_contractual: keep calendar date and store an explanatory note
   */
  PAYMENT_DATE_POLICY: z
    .enum(['next_business_day', 'keep_contractual'])
    .default('next_business_day'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  console.error('❌ Invalid environment configuration:\n' + formatted);
  process.exit(1);
}

export type Env = z.infer<typeof envSchema>;

const env: Readonly<Env> = Object.freeze(parsed.data);

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export default env;
