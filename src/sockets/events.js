/**
 * Socket.IO event name constants.
 * Keep client and server in sync via this module.
 */
export const SOCKET_EVENTS = Object.freeze({
  // Connection lifecycle
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Client → server
  PING: 'client:ping',
  JOIN_ROOM: 'client:join_room',
  LEAVE_ROOM: 'client:leave_room',
  NOTIFICATION_READ: 'client:notification_read',

  // Server → client
  PONG: 'server:pong',
  NOTIFICATION: 'server:notification',
  USER_UPDATED: 'server:user_updated',
  FORCE_LOGOUT: 'server:force_logout',
});

export default SOCKET_EVENTS;
