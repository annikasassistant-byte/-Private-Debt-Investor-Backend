export interface ScheduleInput {
  principal: number;
  annualRatePercent: number;
  termMonths: number;
  startDate: Date | string;
  paymentDay?: number;
  repaymentModel?: 'amortizing' | 'interest_only' | 'bullet';
  gracePeriodMonths?: number;
  balloonAmount?: number;
}

export interface ScheduleRow {
  sequence: number;
  dueDate: Date;
  principal: number;
  interest: number;
  total: number;
  remainingBalance: number;
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
 * Generate repayment schedule.
 * - amortizing: classic PMT after optional grace; optional balloon principal on final installment
 * - interest_only: interest each period; full principal on last payment
 * - bullet: $0 until maturity; final payment = full principal + total accrued interest
 */
export function generateRepaymentSchedule(input: ScheduleInput): ScheduleRow[] {
  const principal = Number(input.principal);
  const annualRate = Number(input.annualRatePercent);
  const termMonths = Math.floor(Number(input.termMonths));
  const start = new Date(input.startDate);
  const paymentDay = Math.min(28, Math.max(1, input.paymentDay ?? start.getUTCDate()));
  const model = input.repaymentModel || 'amortizing';
  const grace = Math.max(
    0,
    Math.min(termMonths - 1, Math.floor(Number(input.gracePeriodMonths) || 0)),
  );
  const balloon = Math.max(0, Math.min(principal, Number(input.balloonAmount) || 0));

  if (!(principal > 0) || !(termMonths > 0) || Number.isNaN(start.getTime())) return [];

  const monthlyRate = annualRate / 100 / 12;
  const rows: ScheduleRow[] = [];

  if (model === 'bullet') {
    let balance = principal;
    let accruedInterest = 0;
    for (let i = 0; i < termMonths; i += 1) {
      const dueDate = addMonthsPreserveDay(start, i + 1, paymentDay);
      const periodInterest = round2(balance * monthlyRate);
      accruedInterest = round2(accruedInterest + periodInterest);
      const isLast = i === termMonths - 1;
      if (!isLast) {
        rows.push({
          sequence: i + 1,
          dueDate,
          principal: 0,
          interest: 0,
          total: 0,
          remainingBalance: balance,
        });
      } else {
        rows.push({
          sequence: i + 1,
          dueDate,
          principal: round2(balance),
          interest: accruedInterest,
          total: round2(balance + accruedInterest),
          remainingBalance: 0,
        });
      }
    }
    return rows;
  }

  let balance = principal;
  const amortTerm = Math.max(1, termMonths - grace);
  const amortizingBase = Math.max(0, principal - balloon);
  const pmt =
    model === 'amortizing' ? calculateMonthlyPayment(amortizingBase, annualRate, amortTerm) : 0;

  for (let i = 0; i < termMonths; i += 1) {
    const dueDate = addMonthsPreserveDay(start, i + 1, paymentDay);
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
      // Final: remaining amortizing balance + scheduled balloon
      principalPart = round2(balance);
      total = round2(principalPart + interest);
    } else {
      principalPart = round2(Math.min(balance - balloon, Math.max(0, pmt - interest)));
      // Keep at least `balloon` principal for the final installment when balloon > 0
      if (balloon > 0 && balance - principalPart < balloon) {
        principalPart = round2(Math.max(0, balance - balloon));
      }
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
      dueDate,
      principal: principalPart,
      interest,
      total,
      remainingBalance: balance,
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
    // Balloon only applies to original schedule final installment; remaining regen clears it
    balloonAmount: 0,
  }).map((row, idx) => ({ ...row, sequence: input.fromSequence + idx }));
}
