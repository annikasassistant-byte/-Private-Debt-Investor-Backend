export const STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
  ARCHIVED: 'archived',
});

export const JOB_STATUS = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  DELAYED: 'delayed',
});

export const VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
});

export const STATUS_LIST = Object.freeze(Object.values(STATUS));
export const JOB_STATUS_LIST = Object.freeze(Object.values(JOB_STATUS));
export const VERIFICATION_STATUS_LIST = Object.freeze(Object.values(VERIFICATION_STATUS));

export default STATUS;
