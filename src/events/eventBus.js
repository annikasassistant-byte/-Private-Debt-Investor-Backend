import { EventEmitter } from 'node:events';

/**
 * Application-wide event bus (singleton).
 * Prefer domain modules under `src/events/*.events.js` for listeners.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Emit an event and return whether listeners existed.
   * @param {string | symbol} event
   * @param {...unknown} args
   * @returns {boolean}
   */
  publish(event, ...args) {
    return this.emit(event, ...args);
  }

  /**
   * Subscribe to an event.
   * @param {string | symbol} event
   * @param {(...args: unknown[]) => void} listener
   * @returns {this}
   */
  subscribe(event, listener) {
    this.on(event, listener);
    return this;
  }

  /**
   * Subscribe once.
   * @param {string | symbol} event
   * @param {(...args: unknown[]) => void} listener
   * @returns {this}
   */
  subscribeOnce(event, listener) {
    this.once(event, listener);
    return this;
  }

  /**
   * Unsubscribe.
   * @param {string | symbol} event
   * @param {(...args: unknown[]) => void} listener
   * @returns {this}
   */
  unsubscribe(event, listener) {
    this.off(event, listener);
    return this;
  }
}

const eventBus = new EventBus();

export { EventBus };
export default eventBus;
