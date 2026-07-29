import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from '../config/env.js';
import { sendMail } from '../utils/mail.helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../templates/emails');

export class EmailService {
  async #render(templateName, variables = {}) {
    const filePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
    let html;
    try {
      html = await fs.readFile(filePath, 'utf8');
    } catch {
      html = this.#fallbackTemplate(templateName, variables);
    }

    return Object.entries({
      appName: env.APP_NAME,
      appUrl: env.FRONTEND_URL,
      ...variables,
    }).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value ?? '')), html);
  }

  #fallbackTemplate(name, variables) {
    const title = name.replace(/-/g, ' ');
    const body = Object.entries(variables)
      .map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`)
      .join('\n');
    return `<!DOCTYPE html><html><body><h1>${title}</h1>${body}<p>— ${env.APP_NAME}</p></body></html>`;
  }

  async send({ to, subject, html, text }) {
    return sendMail({ to, subject, html, text });
  }

  async sendVerification(user, token) {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
    const html = await this.#render('verification', {
      firstName: user.firstName,
      verifyUrl,
      expiresHours: Math.ceil(env.EMAIL_VERIFY_EXPIRES_MS / 3600000),
    });
    return this.send({
      to: user.email,
      subject: `Verify your ${env.APP_NAME} email`,
      html,
    });
  }

  async sendPasswordReset(user, token) {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const html = await this.#render('password-reset', {
      firstName: user.firstName,
      resetUrl,
      expiresMinutes: Math.ceil(env.PASSWORD_RESET_EXPIRES_MS / 60000),
    });
    return this.send({
      to: user.email,
      subject: `Reset your ${env.APP_NAME} password`,
      html,
    });
  }

  async sendPasswordResetOtp(user, otp) {
    const expiresMinutes = Math.ceil(env.OTP_EXPIRES_MS / 60000) || 10;
    const html = await this.#render('password-reset-otp', {
      firstName: user.firstName,
      otp,
      expiresMinutes,
    });
    return this.send({
      to: user.email,
      subject: `${otp} is your ${env.APP_NAME} password reset code`,
      html,
      text: `Your password reset code is ${otp}. It expires in ${expiresMinutes} minutes.`,
    });
  }

  async sendWelcome(user) {
    const html = await this.#render('welcome', {
      firstName: user.firstName,
      loginUrl: `${env.FRONTEND_URL}/login`,
    });
    return this.send({
      to: user.email,
      subject: `Welcome to ${env.APP_NAME}`,
      html,
    });
  }
}

export default EmailService;
