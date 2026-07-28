/**
 * Socket.IO bootstrap placeholder — attach real handlers when ready.
 * @param {import('http').Server} httpServer
 * @param {{ corsOrigin?: string, path?: string }} [options]
 * @returns {import('socket.io').Server|null}
 */
export async function initSocketIo(httpServer, options = {}) {
  try {
    const { Server } = await import('socket.io');
    const env = (await import('../config/env.js')).default;

    const io = new Server(httpServer, {
      path: options.path || env.SOCKET_PATH,
      cors: {
        origin: options.corsOrigin || env.SOCKET_CORS_ORIGIN,
        credentials: true,
      },
      pingTimeout: env.SOCKET_PING_TIMEOUT,
      pingInterval: env.SOCKET_PING_INTERVAL,
    });

    io.on('connection', (socket) => {
      socket.emit('ready', { message: 'Socket.IO connected', id: socket.id });
    });

    return io;
  } catch (err) {
    const logger = (await import('../config/logger.js')).default;
    logger.warn('Socket.IO not initialized', { message: err.message });
    return null;
  }
}

export default initSocketIo;
