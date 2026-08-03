export const INVESTMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  MATURED: 'matured',
  CLOSED: 'closed',
});

export const PAYMENT_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  UPCOMING: 'upcoming',
  COMPLETED: 'completed',
  PARTIALLY_PAID: 'partially_paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  FUTURE: 'future',
});

export const REPAYMENT_MODEL = Object.freeze({
  AMORTIZING: 'amortizing',
  INTEREST_ONLY: 'interest_only',
  BULLET: 'bullet',
  FIXED_MONTHLY_PAYMENT: 'fixed_monthly_payment',
});

export const REPORT_CATEGORY = Object.freeze({
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUAL: 'annual',
  KPI: 'kpi',
  OTHER: 'other',
});

export const CONTRACT_TYPE = Object.freeze({
  LOAN_AGREEMENT: 'loan_agreement',
  SUBORDINATED_LOAN: 'subordinated_loan',
  AMENDMENT: 'amendment',
  ADDITIONAL: 'additional',
});

export const INVESTOR_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

export const TIMELINE_EVENT_TYPE = Object.freeze({
  INVESTMENT_STARTED: 'investment_started',
  LOAN_FUNDED: 'loan_funded',
  SCHEDULED_PAYMENT: 'scheduled_payment',
  COMPLETED_PAYMENT: 'completed_payment',
  INTEREST_PAYMENT: 'interest_payment',
  UPCOMING_PAYMENT: 'upcoming_payment',
  OVERDUE_PAYMENT: 'overdue_payment',
  LOAN_CLOSED: 'loan_closed',
});
