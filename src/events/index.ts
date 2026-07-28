import eventBus from './eventBus.js';
import { registerUserEventListeners, USER_EVENTS } from './user.events.js';
import logger from '../config/logger.js';

/**
 * Register all domain event listeners.
 */
export function initEvents() {
  registerUserEventListeners();
  logger.info('Event bus initialized');
  return eventBus;
}

export { eventBus, USER_EVENTS, registerUserEventListeners };
export default {
  initEvents,
  eventBus,
  USER_EVENTS,
};
