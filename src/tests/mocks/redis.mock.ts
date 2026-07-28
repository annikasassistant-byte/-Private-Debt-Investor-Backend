/**
 * In-memory Redis mock for unit tests.
 * Implements a subset of ioredis commands used by helpers/services.
 */
export function createRedisMock(initial = {}) {
  /** @type {Map<string, { value: string, expiresAt: number | null }>} */
  const store = new Map();

  for (const [key, value] of Object.entries(initial)) {
    store.set(key, { value: String(value), expiresAt: null });
  }

  function isExpired(entry) {
    return entry.expiresAt !== null && Date.now() >= entry.expiresAt;
  }

  function getEntry(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      store.delete(key);
      return null;
    }
    return entry;
  }

  const client = {
    status: 'ready',

    async get(key) {
      const entry = getEntry(key);
      return entry ? entry.value : null;
    },

    async set(key, value, ...args) {
      let expiresAt = null;
      const exIndex = args.findIndex((a) => String(a).toUpperCase() === 'EX');
      if (exIndex !== -1 && args[exIndex + 1] != null) {
        expiresAt = Date.now() + Number(args[exIndex + 1]) * 1000;
      }
      const pxIndex = args.findIndex((a) => String(a).toUpperCase() === 'PX');
      if (pxIndex !== -1 && args[pxIndex + 1] != null) {
        expiresAt = Date.now() + Number(args[pxIndex + 1]);
      }
      store.set(String(key), { value: String(value), expiresAt });
      return 'OK';
    },

    async del(...keys) {
      let count = 0;
      for (const key of keys.flat()) {
        if (store.delete(String(key))) count += 1;
      }
      return count;
    },

    async exists(...keys) {
      return keys.flat().filter((k) => getEntry(String(k))).length;
    },

    async incr(key) {
      const entry = getEntry(key);
      const next = Number(entry?.value || 0) + 1;
      store.set(String(key), { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },

    async expire(key, seconds) {
      const entry = getEntry(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + Number(seconds) * 1000;
      store.set(String(key), entry);
      return 1;
    },

    async ttl(key) {
      const entry = getEntry(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    },

    async ping() {
      return 'PONG';
    },

    async quit() {
      store.clear();
      client.status = 'end';
      return 'OK';
    },

    disconnect() {
      store.clear();
      client.status = 'end';
    },

    on() {
      return client;
    },

    /** Test helper */
    __store: store,
    __clear() {
      store.clear();
    },
  };

  return client;
}

export default createRedisMock;
