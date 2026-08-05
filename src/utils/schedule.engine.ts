import { applyPaymentDatePolicy, resolvePaymentDatePolicy } from './businessCalendar.js';

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function addMonthsPreserveDay(date, months, paymentDay) {
  const d = new Date(date.getTime());
  const day = paymentDay ?? d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months, 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * Month offset from investment start → first contractual installment.
 *
 * Product rule (QA):
 * - start day < payment day → candidate same month on payment day
 * - start day >= payment day → next month on payment day
 * - If same-month candidate is fewer than 14 days after start, bump +1 month
 *   (Aug 10 + day 15 → Sep 15, not Aug 15)
 *
 * Documented equal-day choice: start 15 + day 15 → next month (Oct 15).
 */
export function resolveFirstPaymentMonthOffset(start, paymentDay) {
  const startDay = start.getUTCDate();
  const day = paymentDay ?? startDay;
  let offset = startDay < day ? 0 : 1;
  const candidate = addMonthsPreserveDay(start, offset, day);
  const leadDays = (candidate.getTime() - start.getTime()) / 86_400_000;
  if (leadDays < 14) {
    offset += 1;
  }
  return offset;
}

export function calculateMonthlyPayment(principal, annualRatePercent, termMonths) {
  if (termMonths <= 0 || principal <= 0) return 0;
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return round2(principal / termMonths);
  const factor = Math.pow(1 + r, termMonths);
  return round2((principal * r * factor) / (factor - 1));
}

/**
 * Fixed monthly payment: total = principal + flat financing fee,
 * split evenly. Fee is principal * feePercent / 100 (not compound).
 * Does not support grace or balloon — callers must reject those fields.
 */
export function calculateFixedMonthlyPayment(principal, feePercent, termMonths) {
  if (termMonths <= 0 || principal <= 0) return 0;
  const totalFee = round2(principal * (feePercent / 100));
  return round2((principal + totalFee) / termMonths);
}

function buildFixedMonthlyRows(
  principal,
  feePercent,
  termMonths,
  start,
  paymentDay,
  policy,
  firstOffset,
) {
  const totalFee = round2(principal * (feePercent / 100));
  const totalRepayment = round2(principal + totalFee);
  const baseMonthly = round2(totalRepayment / termMonths);
  const baseFee = round2(totalFee / termMonths);
  const basePrincipal = round2(baseMonthly - baseFee);

  const rows = [];
  let remainingPrincipal = principal;
  let remainingFee = totalFee;

  for (let i = 0; i < termMonths; i += 1) {
    const contractual = addMonthsPreserveDay(start, firstOffset + i, paymentDay);
    const adjusted = applyPaymentDatePolicy(contractual, policy);
    const isLast = i === termMonths - 1;

    let principalPart;
    let interest;
    let total;

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

/**
 * Bullet: single maturity payment of principal + simple accrued financing fee.
 * Distinct from interest_only (which charges fee every period and principal at end).
 */
function buildBulletRows(
  principal,
  annualRate,
  termMonths,
  start,
  paymentDay,
  policy,
  firstOffset,
) {
  const monthlyRate = annualRate / 100 / 12;
  const contractual = addMonthsPreserveDay(start, firstOffset + termMonths - 1, paymentDay);
  const adjusted = applyPaymentDatePolicy(contractual, policy);
  const interest = round2(principal * monthlyRate * termMonths);
  const principalPart = round2(principal);
  return [
    {
      sequence: 1,
      dueDate: adjusted.dueDate,
      contractualDueDate: adjusted.contractualDueDate,
      principal: principalPart,
      interest,
      total: round2(principalPart + interest),
      remainingBalance: 0,
      dateAdjustmentNote: adjusted.note,
    },
  ];
}

export function generateRepaymentSchedule(input) {
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

  const firstOffset =
    input.firstMonthOffset != null
      ? Math.max(0, Math.floor(Number(input.firstMonthOffset)))
      : resolveFirstPaymentMonthOffset(start, paymentDay);

  if (model === 'fixed_monthly_payment') {
    return buildFixedMonthlyRows(
      principal,
      annualRate,
      termMonths,
      start,
      paymentDay,
      policy,
      firstOffset,
    );
  }

  if (model === 'bullet') {
    return buildBulletRows(
      principal,
      annualRate,
      termMonths,
      start,
      paymentDay,
      policy,
      firstOffset,
    );
  }

  const monthlyRate = annualRate / 100 / 12;
  const rows = [];
  let balance = principal;
  const amortTerm = Math.max(1, termMonths - grace);
  const pmt =
    model === 'amortizing'
      ? calculateMonthlyPayment(Math.max(0, principal - balloon), annualRate, amortTerm)
      : 0;

  for (let i = 0; i < termMonths; i += 1) {
    const contractual = addMonthsPreserveDay(start, firstOffset + i, paymentDay);
    const adjusted = applyPaymentDatePolicy(contractual, policy);
    const interest = round2(balance * monthlyRate);
    let principalPart = 0;
    let total = 0;
    const inGrace = i < grace;
    const isLast = i === termMonths - 1;

    if (model === 'interest_only') {
      principalPart = isLast ? round2(balance) : 0;
      total = round2(interest + principalPart);
    } else if (inGrace) {
      principalPart = 0;
      total = round2(interest);
    } else if (isLast) {
      principalPart = round2(balance);
      total = round2(principalPart + interest);
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

export function regenerateRemainingSchedule(input) {
  const remainingTerm = Math.max(
    0,
    Math.floor(Number(input.termMonths)) - Math.floor(Number(input.fromSequence)) + 1,
  );
  if (remainingTerm <= 0 || !(input.remainingPrincipal > 0)) return [];

  const start = new Date(input.startDate);
  const paymentDay = input.paymentDay ?? start.getUTCDate();
  const firstOffset = resolveFirstPaymentMonthOffset(start, paymentDay);

  return generateRepaymentSchedule({
    ...input,
    principal: input.remainingPrincipal,
    termMonths: remainingTerm,
    startDate: start,
    gracePeriodMonths: 0,
    balloonAmount: 0,
    firstMonthOffset: firstOffset + Math.floor(Number(input.fromSequence)) - 1,
  }).map((row, idx) => ({ ...row, sequence: Number(input.fromSequence) + idx }));
}

export { resolvePaymentDatePolicy, addMonthsPreserveDay };
export default {
  calculateMonthlyPayment,
  calculateFixedMonthlyPayment,
  generateRepaymentSchedule,
  regenerateRemainingSchedule,
  resolveFirstPaymentMonthOffset,
};
