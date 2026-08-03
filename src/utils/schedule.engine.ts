import {
  applyPaymentDatePolicy,
  resolvePaymentDatePolicy,
  type PaymentDatePolicy,
} from './businessCalendar.js';

export type RepaymentModel = 'amortizing' | 'interest_only' | 'bullet' | 'fixed_monthly_payment';

export interface ScheduleInput {
  principal: number;
  annualRatePercent: number;
  termMonths: number;
  startDate: Date | string;
  paymentDay?: number;
  repaymentModel?: RepaymentModel;
  gracePeriodMonths?: number;
  balloonAmount?: number;
  /** Weekend/holiday handling — default next_business_day */
  paymentDatePolicy?: PaymentDatePolicy;
}

export interface ScheduleRow {
  sequence: number;
  dueDate: Date;
  contractualDueDate: Date;
  principal: number;
  interest: number;
  total: number;
  remainingBalance: number;
  dateAdjustmentNote: string;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function addMonthsPreserveDay(date: Date, months: number, paymentDay?: number): Date {
  const d = new Date(date.getTime());
  const day = paymentDay ?? d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months, 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function calculateMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  if (termMonths <= 0 || principal <= 0) return 0;
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return round2(principal / termMonths);
  const factor = Math.pow(1 + r, termMonths);
  return round2((principal * r * factor) / (factor - 1));
}

/**
 * Fixed monthly payment: total = principal + flat financing fee,
 * split evenly. Fee is principal * feePercent / 100 (not compound).
 */
export function calculateFixedMonthlyPayment(
  principal: number,
  feePercent: number,
  termMonths: number,
): number {
  if (termMonths <= 0 || principal <= 0) return 0;
  const totalFee = round2(principal * (feePercent / 100));
  return round2((principal + totalFee) / termMonths);
}

function buildFixedMonthlyRows(
  principal: number,
  feePercent: number,
  termMonths: number,
  start: Date,
  paymentDay: number,
  policy: ReturnType<typeof resolvePaymentDatePolicy>,
): ScheduleRow[] {
  const totalFee = round2(principal * (feePercent / 100));
  const totalRepayment = round2(principal + totalFee);
  const baseMonthly = round2(totalRepayment / termMonths);
  const baseFee = round2(totalFee / termMonths);
  const basePrincipal = round2(baseMonthly - baseFee);

  const rows: ScheduleRow[] = [];
  let remainingPrincipal = principal;
  let remainingFee = totalFee;

  for (let i = 0; i < termMonths; i += 1) {
    const contractual = addMonthsPreserveDay(start, i + 1, paymentDay);
    const adjusted = applyPaymentDatePolicy(contractual, policy);
    const isLast = i === termMonths - 1;

    let principalPart: number;
    let interest: number;
    let total: number;

    if (isLast) {
      principalPart = round2(remainingPrincipal);
      interest = round2(remainingFee);
      total = round2(principalPart + interest);
    } else {
      principalPart = round2(Math.min(remainingPrincipal, basePrincipal));
      interest = round2(Math.min(remainingFee, baseFee));
      total = round2(principalPart + interest);
      const drift = round2(baseMonthly - total);
      if (drift !== 0 && Math.abs(drift) < 0.05) {
        interest = round2(interest + drift);
        total = round2(principalPart + interest);
      }
    }

    remainingPrincipal = round2(Math.max(0, remainingPrincipal - principalPart));
    remainingFee = round2(Math.max(0, remainingFee - interest));

    rows.push({
      sequence: i + 1,
      dueDate: adjusted.dueDate,
      contractualDueDate: adjusted.contractualDueDate,
      principal: principalPart,
      interest,
      total,
      remainingBalance: remainingPrincipal,
      dateAdjustmentNote: adjusted.note,
    });
  }

  return rows;
}

export function generateRepaymentSchedule(input: ScheduleInput): ScheduleRow[] {
  const principal = Number(input.principal);
  const annualRate = Number(input.annualRatePercent);
  const termMonths = Math.floor(Number(input.termMonths));
  const start = new Date(input.startDate);
  const paymentDay = input.paymentDay ?? start.getUTCDate();
  const model = input.repaymentModel || 'amortizing';
  const grace = Math.max(0, Math.floor(Number(input.gracePeriodMonths) || 0));
  const balloon = Math.max(0, Number(input.balloonAmount) || 0);
  const policy = resolvePaymentDatePolicy(input.paymentDatePolicy);

  if (!(principal > 0) || !(termMonths > 0) || Number.isNaN(start.getTime())) return [];

  if (model === 'fixed_monthly_payment') {
    return buildFixedMonthlyRows(principal, annualRate, termMonths, start, paymentDay, policy);
  }

  const monthlyRate = annualRate / 100 / 12;
  const rows: ScheduleRow[] = [];
  let balance = principal;
  const amortTerm = Math.max(1, termMonths - grace);
  const pmt =
    model === 'amortizing'
      ? calculateMonthlyPayment(Math.max(0, principal - balloon), annualRate, amortTerm)
      : 0;

  for (let i = 0; i < termMonths; i += 1) {
    const contractual = addMonthsPreserveDay(start, i + 1, paymentDay);
    const adjusted = applyPaymentDatePolicy(contractual, policy);
    const interest = round2(balance * monthlyRate);
    let principalPart = 0;
    let total = 0;
    const inGrace = i < grace;
    const isLast = i === termMonths - 1;

    if (model === 'interest_only' || model === 'bullet') {
      principalPart = isLast ? round2(balance) : 0;
      total = round2(interest + principalPart);
    } else if (inGrace) {
      principalPart = 0;
      total = round2(interest);
    } else if (isLast) {
      principalPart = round2(balance);
      total = round2(principalPart + interest);
      if (balloon > 0) {
        // balloon already excluded from amortizing PMT; ensure last clears
      }
    } else {
      principalPart = round2(Math.min(balance, Math.max(0, pmt - interest)));
      total = round2(principalPart + interest);
    }

    balance = round2(Math.max(0, balance - principalPart));
    if (isLast && balance > 0) {
      principalPart = round2(principalPart + balance);
      total = round2(total + balance);
      balance = 0;
    }

    rows.push({
      sequence: i + 1,
      dueDate: adjusted.dueDate,
      contractualDueDate: adjusted.contractualDueDate,
      principal: principalPart,
      interest,
      total,
      remainingBalance: balance,
      dateAdjustmentNote: adjusted.note,
    });
  }

  return rows;
}

export function regenerateRemainingSchedule(
  input: ScheduleInput & { remainingPrincipal: number; fromSequence: number },
): ScheduleRow[] {
  const remainingTerm = Math.max(
    0,
    Math.floor(Number(input.termMonths)) - Math.floor(Number(input.fromSequence)) + 1,
  );
  if (remainingTerm <= 0 || !(input.remainingPrincipal > 0)) return [];

  const start = new Date(input.startDate);
  const paymentDay = input.paymentDay ?? start.getUTCDate();
  const anchor = addMonthsPreserveDay(start, input.fromSequence - 1, paymentDay);

  return generateRepaymentSchedule({
    ...input,
    principal: input.remainingPrincipal,
    termMonths: remainingTerm,
    startDate: anchor,
    gracePeriodMonths: 0,
  }).map((row, idx) => ({ ...row, sequence: input.fromSequence + idx }));
}

export { resolvePaymentDatePolicy };
export default {
  calculateMonthlyPayment,
  calculateFixedMonthlyPayment,
  generateRepaymentSchedule,
  regenerateRemainingSchedule,
};
