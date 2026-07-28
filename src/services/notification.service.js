import logger from '../config/logger.js';

/**
 * In-app notification service — persistence-ready stub.
 * Wire to a Notification model / queue later without changing call sites.
 */
export class NotificationService {
  /**
   * @param {{ notificationRepository?: { create: Function } }} [deps]
   */
  constructor(deps = {}) {
    this.notificationRepository = deps.notificationRepository || null;
    /** @type {Map<string, object[]>} */
    this.#memory = new Map();
  }

  #memory;

  /**
   * @param {{
   *   userId: string,
   *   type?: string,
   *   title: string,
   *   body?: string,
   *   data?: object,
   *   channel?: 'in-app'|'email'|'push',
   * }} payload
   */
  async notify(payload) {
    const notification = {
      id: cryptoRandom(),
      userId: String(payload.userId),
      type: payload.type || 'info',
      title: payload.title,
      body: payload.body || '',
      data: payload.data || {},
      channel: payload.channel || 'in-app',
      read: false,
      createdAt: new Date().toISOString(),
    };

    if (this.notificationRepository) {
      try {
        const saved = await this.notificationRepository.create(notification);
        return saved;
      } catch (err) {
        logger.warn('Notification persistence failed, using memory', { message: err.message });
      }
    }

    const list = this.#memory.get(notification.userId) || [];
    list.unshift(notification);
    this.#memory.set(notification.userId, list.slice(0, 200));
    logger.debug('In-app notification stored', { userId: notification.userId, title: notification.title });
    return notification;
  }

  async listForUser(userId, { limit = 50 } = {}) {
    if (this.notificationRepository?.findMany) {
      return this.notificationRepository.findMany(
        { userId },
        { page: 1, limit, sort: '-createdAt' },
      );
    }
    const list = this.#memory.get(String(userId)) || [];
    return {
      data: list.slice(0, limit),
      pagination: { page: 1, limit, total: list.length, totalPages: 1 },
    };
  }

  async markRead(userId, notificationId) {
    const list = this.#memory.get(String(userId)) || [];
    const item = list.find((n) => n.id === notificationId);
    if (item) item.read = true;
    return item || null;
  }
}

function cryptoRandom() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default NotificationService;
