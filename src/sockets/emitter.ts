import { SOCKET_EVENTS } from './events.js';

/** @type {import('socket.io').Server|null} */
let ioInstance = null;

export function setSocketIo(io) {
  ioInstance = io;
}

export function getSocketIo() {
  return ioInstance;
}

export function emitToUser(userId, event, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}

export function emitToInvestor(investorId, event, payload) {
  if (!ioInstance || !investorId) return;
  ioInstance.to(`investor:${investorId}`).emit(event, payload);
}

export function emitToAdmins(event, payload) {
  if (!ioInstance) return;
  ioInstance.to('role:admin').emit(event, payload);
}

export function emitDomainEvent(kind, payload) {
  const event =
    kind === 'payment'
      ? SOCKET_EVENTS.PAYMENT_UPDATED
      : kind === 'timeline'
        ? SOCKET_EVENTS.TIMELINE_UPDATED
        : kind === 'dashboard'
          ? SOCKET_EVENTS.DASHBOARD_UPDATED
          : SOCKET_EVENTS.NOTIFICATION;

  const investorId = payload?.investorId || payload?.investor;
  const userId = payload?.userId;

  emitToAdmins(event, payload);
  if (investorId) emitToInvestor(String(investorId), event, payload);
  if (userId) emitToUser(String(userId), event, payload);
}

/** Broadcast payment + timeline + dashboard so clients refetch all portfolio views. */
export function emitPortfolioRefresh(payload) {
  emitDomainEvent('payment', payload);
  emitDomainEvent('timeline', payload);
  emitDomainEvent('dashboard', payload);
}

export default {
  setSocketIo,
  getSocketIo,
  emitToUser,
  emitToInvestor,
  emitToAdmins,
  emitDomainEvent,
  emitPortfolioRefresh,
};
