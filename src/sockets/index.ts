import { SOCKET_EVENTS } from './events.js';
import { setSocketIo } from './emitter.js';

/**
 * Socket.IO bootstrap with JWT auth and role/investor rooms.
 * @param {import('http').Server} httpServer
 * @param {{ corsOrigin?: string, path?: string }} [options]
 * @returns {import('socket.io').Server|null}
 */
export async function initSocketIo(httpServer, options = {}) {
  try {
    const { Server } = await import('socket.io');
    const env = (await import('../config/env.js')).default;
    const { verifyAccessToken } = await import('../utils/jwt.helper.js');
    const logger = (await import('../config/logger.js')).default;
    const Investor = (await import('../models/investor.model.js')).default;
    const User = (await import('../models/user.model.js')).default;

    const io = new Server(httpServer, {
      path: options.path || env.SOCKET_PATH,
      cors: {
        origin: options.corsOrigin || env.SOCKET_CORS_ORIGIN,
        credentials: true,
      },
      pingTimeout: env.SOCKET_PING_TIMEOUT,
      pingInterval: env.SOCKET_PING_INTERVAL,
    });

    io.use(async (socket, next) => {
      try {
        const cookieHeader = socket.handshake.headers?.cookie || '';
        const accessCookieName = env.ACCESS_COOKIE_NAME || 'access_token';
        const cookieToken = String(cookieHeader)
          .split(';')
          .map((p) => p.trim())
          .find((p) => p.startsWith(`${accessCookieName}=`))
          ?.slice(accessCookieName.length + 1);
        const token =
          socket.handshake.auth?.token ||
          (typeof socket.handshake.headers?.authorization === 'string'
            ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
            : null) ||
          (cookieToken ? decodeURIComponent(cookieToken) : null);
        if (!token) return next(new Error('Unauthorized'));

        const { container } = await import('../di/container.js');
        const blacklisted = await container.tokenService.isAccessTokenBlacklisted(token);
        if (blacklisted) return next(new Error('Unauthorized'));

        const payload = verifyAccessToken(token);
        const userId = payload.sub || payload.userId;
        if (!userId) return next(new Error('Unauthorized'));
        const user = await User.findById(userId).populate('role', 'slug name');
        if (!user || user.isDeleted || !user.isActive) return next(new Error('Unauthorized'));
        if (
          typeof user.isAccountLocked === 'function'
            ? user.isAccountLocked()
            : user.isLocked && user.lockUntil && user.lockUntil > new Date()
        ) {
          return next(new Error('Unauthorized'));
        }
        socket.data.userId = String(user._id);
        socket.data.roleSlug = user.role?.slug || '';
        const investor = await Investor.findOne({
          user: user._id,
          isDeleted: { $ne: true },
        }).lean();
        socket.data.investorId = investor ? String(investor._id) : null;
        return next();
      } catch (err) {
        return next(new Error('Unauthorized'));
      }
    });

    io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
      const { userId, roleSlug, investorId } = socket.data;
      socket.join(`user:${userId}`);
      if (roleSlug === 'admin') socket.join('role:admin');
      if (investorId) socket.join(`investor:${investorId}`);

      socket.emit(SOCKET_EVENTS.READY, {
        message: 'Socket.IO connected',
        id: socket.id,
        userId,
        investorId,
      });

      socket.on(SOCKET_EVENTS.PING, () => {
        socket.emit(SOCKET_EVENTS.PONG, { at: new Date().toISOString() });
      });

      socket.on(SOCKET_EVENTS.JOIN_ROOM, (room) => {
        if (typeof room === 'string' && room.startsWith('public:')) {
          socket.join(room);
        }
      });

      socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        logger.debug?.('Socket disconnected', { id: socket.id, userId });
      });
    });

    setSocketIo(io);
    return io;
  } catch (err) {
    const logger = (await import('../config/logger.js')).default;
    logger.warn('Socket.IO not initialized', { message: err.message });
    return null;
  }
}

export default initSocketIo;
