import logger from '../config/logger.js';
import eventBus from './eventBus.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { enqueueNotification } from '../queues/notification.queue.js';

export const USER_EVENTS = Object.freeze({
  REGISTERED: 'user.registered',
  LOGIN: 'user.login',
  LOGOUT: 'user.logout',
  PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  EMAIL_VERIFIED: 'user.email_verified',
});

/**
 * @param {{ user: object, token?: string }} payload
 */
async function onUserRegistered(payload) {
  const { user, token } = payload || {};
  if (!user?.email) {
    logger.warn('USER_REGISTERED missing user.email');
    return;
  }

  logger.info('User registered event', { userId: user._id || user.id, email: user.email });

  try {
    if (token) {
      await enqueueEmail({ type: 'verification', user, token });
    } else {
      await enqueueEmail({ type: 'welcome', user });
    }

    await enqueueNotification({
      userId: String(user._id || user.id),
      type: 'welcome',
      title: 'Welcome',
      body: 'Your account has been created successfully.',
      channel: 'in-app',
    });
  } catch (err) {
    logger.error('USER_REGISTERED handler failed', { message: err.message });
  }
}

/**
 * @param {{ user: object, ip?: string, userAgent?: string, deviceId?: string }} payload
 */
async function onUserLogin(payload) {
  const { user, ip, userAgent, deviceId } = payload || {};
  if (!user) {
    logger.warn('USER_LOGIN missing user');
    return;
  }

  logger.info('User login event', {
    userId: user._id || user.id,
    email: user.email,
    ip,
    deviceId,
    userAgent: userAgent ? String(userAgent).slice(0, 120) : undefined,
  });

  try {
    await enqueueNotification({
      userId: String(user._id || user.id),
      type: 'security',
      title: 'New sign-in',
      body: ip ? `Signed in from ${ip}` : 'A new sign-in was detected on your account.',
      data: { ip, deviceId, userAgent },
      channel: 'in-app',
    });
  } catch (err) {
    logger.error('USER_LOGIN handler failed', { message: err.message });
  }
}

/**
 * Register user domain event listeners (idempotent).
 */
export function registerUserEventListeners() {
  eventBus.removeAllListeners(USER_EVENTS.REGISTERED);
  eventBus.removeAllListeners(USER_EVENTS.LOGIN);

  eventBus.subscribe(USER_EVENTS.REGISTERED, (payload) => {
    onUserRegistered(payload).catch((err) => {
      logger.error('USER_REGISTERED async error', { message: err.message });
    });
  });

  eventBus.subscribe(USER_EVENTS.LOGIN, (payload) => {
    onUserLogin(payload).catch((err) => {
      logger.error('USER_LOGIN async error', { message: err.message });
    });
  });

  logger.info('User event listeners registered', {
    events: [USER_EVENTS.REGISTERED, USER_EVENTS.LOGIN],
  });
}

export { onUserRegistered, onUserLogin };
export default {
  USER_EVENTS,
  registerUserEventListeners,
};
