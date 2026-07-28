import nodemailer from 'nodemailer';
import env from './env.js';
import logger from './logger.js';

/** @type {import('nodemailer').Transporter | null} */
let transporter = null;

/**
 * Create and cache the nodemailer transporter.
 * @returns {import('nodemailer').Transporter}
 */
export function getMailTransporter() {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10,
  });

  transporter.on('error', (err) => {
    logger.error('SMTP transporter error', { message: err.message });
  });

  return transporter;
}

/**
 * Verify SMTP connectivity.
 * @returns {Promise<boolean>}
 */
export async function verifyMailConnection() {
  try {
    const mailer = getMailTransporter();
    await mailer.verify();
    logger.info('SMTP connection verified');
    return true;
  } catch (error) {
    logger.warn('SMTP connection verification failed', { message: error.message });
    return false;
  }
}

/**
 * Default "from" header for outgoing mail.
 * @returns {string}
 */
export function getDefaultFrom() {
  return `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`;
}

/**
 * Close the transporter pool.
 * @returns {Promise<void>}
 */
export async function closeMailTransporter() {
  if (!transporter) return;
  transporter.close();
  transporter = null;
  logger.info('SMTP transporter closed');
}

export const mailConfig = Object.freeze({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  fromName: env.SMTP_FROM_NAME,
  fromEmail: env.SMTP_FROM_EMAIL,
});

export default {
  getMailTransporter,
  verifyMailConnection,
  getDefaultFrom,
  closeMailTransporter,
  mailConfig,
};
