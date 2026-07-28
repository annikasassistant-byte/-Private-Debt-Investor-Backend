import env from './env.js';
import logger from './logger.js';

/**
 * AWS S3 configuration derived from environment.
 * Soft stub — no AWS SDK hard dependency; consumers can wire `@aws-sdk/client-s3`
 * using these credentials when the package is installed.
 */
export const awsConfig = Object.freeze({
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  region: env.AWS_REGION,
  bucket: env.AWS_S3_BUCKET,
  endpoint: env.AWS_S3_ENDPOINT || undefined,
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
});

/**
 * Whether S3 credentials and bucket appear configured.
 * @returns {boolean}
 */
export function isS3Configured() {
  return Boolean(
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET && env.AWS_REGION,
  );
}

/**
 * Build a plain S3 client config object suitable for `@aws-sdk/client-s3` `S3Client`.
 * @returns {{
 *   region: string,
 *   credentials: { accessKeyId: string, secretAccessKey: string },
 *   endpoint?: string,
 *   forcePathStyle?: boolean
 * } | null}
 */
export function getS3ClientConfig() {
  if (!isS3Configured()) {
    logger.warn('AWS S3 is not fully configured');
    return null;
  }

  const config = {
    region: awsConfig.region,
    credentials: {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
    },
  };

  if (awsConfig.endpoint) {
    config.endpoint = awsConfig.endpoint;
    config.forcePathStyle = awsConfig.forcePathStyle;
  }

  return config;
}

/**
 * Build a public or path-style object URL for a given key.
 * @param {string} key
 * @returns {string | null}
 */
export function buildS3ObjectUrl(key) {
  if (!awsConfig.bucket || !key) {
    return null;
  }

  if (awsConfig.endpoint) {
    const base = awsConfig.endpoint.replace(/\/$/, '');
    return `${base}/${awsConfig.bucket}/${key.replace(/^\//, '')}`;
  }

  return `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${key.replace(/^\//, '')}`;
}

/**
 * Placeholder factory that returns a lightweight S3 adapter using fetch-free config only.
 * Actual SDK client creation is deferred to application services.
 * @returns {{
 *   config: ReturnType<typeof getS3ClientConfig>,
 *   bucket: string,
 *   isConfigured: boolean,
 *   getObjectUrl: (key: string) => string | null
 * }}
 */
export function createS3Adapter() {
  return {
    config: getS3ClientConfig(),
    bucket: awsConfig.bucket,
    isConfigured: isS3Configured(),
    getObjectUrl: buildS3ObjectUrl,
  };
}

export default {
  awsConfig,
  isS3Configured,
  getS3ClientConfig,
  buildS3ObjectUrl,
  createS3Adapter,
};
