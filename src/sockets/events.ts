/**
 * Socket.IO event name constants.
 * Keep client and server in sync via this module.
 */
export const SOCKET_EVENTS = Object.freeze({
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  PING: 'client:ping',
  JOIN_ROOM: 'client:join_room',
  LEAVE_ROOM: 'client:leave_room',
  NOTIFICATION_READ: 'client:notification_read',

  PONG: 'server:pong',
  NOTIFICATION: 'server:notification',
  USER_UPDATED: 'server:user_updated',
  FORCE_LOGOUT: 'server:force_logout',
  PAYMENT_UPDATED: 'server:payment_updated',
  TIMELINE_UPDATED: 'server:timeline_updated',
  DASHBOARD_UPDATED: 'server:dashboard_updated',
  READY: 'ready',
});

export default SOCKET_EVENTS;
