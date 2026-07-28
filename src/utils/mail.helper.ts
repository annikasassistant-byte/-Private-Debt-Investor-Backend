import { getMailTransporter, getDefaultFrom } from '../config/mail.js';
import logger from '../config/logger.js';
import { ApiError } from './ApiError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * @typedef {object} SendMailOptions
 * @property {string|string[]} to
 * @property {string} subject
 * @property {string} [text]
 * @property {string} [html]
 * @property {string} [from]
 * @property {string|string[]} [cc]
 * @property {string|string[]} [bcc]
 * @property {string} [replyTo]
 * @property {import('nodemailer').Attachment[]} [attachments]
 */

/**
 * Send an email via the configured transporter.
 * @param {SendMailOptions} options
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export async function sendMail(options) {
  const { to, subject, text, html, from, cc, bcc, replyTo, attachments } = options;

  if (!to || !subject) {
    throw ApiError.badRequest('Email "to" and "subject" are required');
  }

  if (!text && !html) {
    throw ApiError.badRequest('Email must include text and/or html content');
  }

  try {
    const transporter = getMailTransporter();
    const info = await transporter.sendMail({
      from: from || getDefaultFrom(),
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text,
      html,
      cc,
      bcc,
      replyTo,
      attachments,
    });

    logger.info('Email sent', {
      messageId: info.messageId,
      to,
      subject,
    });

    return info;
  } catch (error) {
    logger.error('Failed to send email', {
      message: error.message,
      to,
      subject,
    });

    throw new ApiError(
      MESSAGES.MAIL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.MAIL_ERROR,
      true,
      { reason: error.message },
    );
  }
}

/**
 * Send a simple HTML email with a plain-text fallback.
 * @param {string|string[]} to
 * @param {string} subject
 * @param {string} html
 * @param {string} [text]
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export async function sendHtmlMail(to, subject, html, text) {
  return sendMail({
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  });
}

/**
 * Send a password-reset email.
 * @param {string} to
 * @param {string} resetUrl
 * @param {string} [userName]
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export async function sendPasswordResetEmail(to, resetUrl, userName = 'User') {
  const subject = 'Reset your password';
  const html = `
    <p>Hi ${userName},</p>
    <p>We received a request to reset your password. Click the link below to continue:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

  return sendHtmlMail(to, subject, html);
}

/**
 * Send an email verification message.
 * @param {string} to
 * @param {string} verifyUrl
 * @param {string} [userName]
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export async function sendVerificationEmail(to, verifyUrl, userName = 'User') {
  const subject = 'Verify your email address';
  const html = `
    <p>Hi ${userName},</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
  `;

  return sendHtmlMail(to, subject, html);
}

/**
 * Send a numeric OTP email.
 * @param {string} to
 * @param {string} otp
 * @param {string} [purpose='verification']
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export async function sendOtpEmail(to, otp, purpose = 'verification') {
  const subject = `Your ${purpose} code`;
  const html = `
    <p>Your one-time ${purpose} code is:</p>
    <h2 style="letter-spacing:4px;">${otp}</h2>
    <p>This code will expire shortly. Do not share it with anyone.</p>
  `;

  return sendHtmlMail(to, subject, html);
}

export default {
  sendMail,
  sendHtmlMail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendOtpEmail,
};
