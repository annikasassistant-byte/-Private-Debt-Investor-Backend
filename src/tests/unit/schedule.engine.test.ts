import { describe, it, expect } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/depth_dashboard_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-characters!';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-cookie-secret-min-32-characters!!';

const { calculateMonthlyPayment, generateRepaymentSchedule, resolveFirstPaymentMonthOffset } =
  await import('../../utils/schedule.engine.js');

function dueKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

describe('schedule.engine', () => {
  const base = {
    principal: 12_000,
    annualRatePercent: 12,
    termMonths: 12,
    startDate: '2026-01-15T00:00:00.000Z',
    paymentDay: 15,
    paymentDatePolicy: 'keep_contractual',
  };

  describe('first payment date rule', () => {
    it('start 2026-09-01 day 15 → first contractual 2026-09-15', () => {
      const start = new Date('2026-09-01T00:00:00.000Z');
      expect(resolveFirstPaymentMonthOffset(start, 15)).toBe(0);
      const rows = generateRepaymentSchedule({
        ...base,
        startDate: start.toISOString(),
        paymentDay: 15,
        repaymentModel: 'amortizing',
        paymentDatePolicy: 'keep_contractual',
      });
      expect(dueKey(rows[0].contractualDueDate || rows[0].dueDate)).toBe('2026-09-15');
    });

    it('start 2026-08-10 day 15 → first contractual 2026-09-15 (<14d same-month bump)', () => {
      const start = new Date('2026-08-10T00:00:00.000Z');
      expect(resolveFirstPaymentMonthOffset(start, 15)).toBe(1);
      const rows = generateRepaymentSchedule({
        ...base,
        startDate: start.toISOString(),
        paymentDay: 15,
        repaymentModel: 'amortizing',
        paymentDatePolicy: 'keep_contractual',
      });
      expect(dueKey(rows[0].contractualDueDate || rows[0].dueDate)).toBe('2026-09-15');
    });

    it('start 2026-09-15 day 15 → first contractual 2026-10-15 (equal day → next month)', () => {
      const start = new Date('2026-09-15T00:00:00.000Z');
      expect(resolveFirstPaymentMonthOffset(start, 15)).toBe(1);
      const rows = generateRepaymentSchedule({
        ...base,
        startDate: start.toISOString(),
        paymentDay: 15,
        repaymentModel: 'amortizing',
        paymentDatePolicy: 'keep_contractual',
      });
      expect(dueKey(rows[0].contractualDueDate || rows[0].dueDate)).toBe('2026-10-15');
    });

    it('weekend shift still applies after base date is chosen', () => {
      // 2026-11-15 is a Sunday → next business day 2026-11-16
      const rows = generateRepaymentSchedule({
        ...base,
        startDate: '2026-10-20T00:00:00.000Z',
        paymentDay: 15,
        termMonths: 2,
        repaymentModel: 'amortizing',
        paymentDatePolicy: 'next_business_day',
      });
      const nov = rows.find((r) => dueKey(r.contractualDueDate).startsWith('2026-11'));
      expect(nov).toBeTruthy();
      expect(dueKey(nov.contractualDueDate)).toBe('2026-11-15');
      expect(dueKey(nov.dueDate)).toBe('2026-11-16');
      expect(String(nov.dateAdjustmentNote || '')).toMatch(/Wochenende|Geschäftstag/i);
    });
  });

  it('grace period charges fee only; balloon reduces amortizing base', () => {
    const rows = generateRepaymentSchedule({
      ...base,
      repaymentModel: 'amortizing',
      gracePeriodMonths: 2,
      balloonAmount: 2_000,
      paymentDatePolicy: 'keep_contractual',
    });
    expect(rows).toHaveLength(12);
    expect(rows[0].principal).toBe(0);
    expect(rows[1].principal).toBe(0);
    expect(rows[0].interest).toBeGreaterThan(0);
    expect(rows[rows.length - 1].remainingBalance).toBe(0);
  });

  it('amortizing produces termMonths rows and clears balance', () => {
    const rows = generateRepaymentSchedule({ ...base, repaymentModel: 'amortizing' });
    expect(rows).toHaveLength(12);
    expect(rows[rows.length - 1].remainingBalance).toBe(0);
    expect(rows.every((r) => r.total > 0)).toBe(true);
    const pmt = calculateMonthlyPayment(base.principal, base.annualRatePercent, base.termMonths);
    expect(rows[0].total).toBeCloseTo(pmt, 1);
  });

  it('interest_only charges fee each period and principal on last', () => {
    const rows = generateRepaymentSchedule({ ...base, repaymentModel: 'interest_only' });
    expect(rows).toHaveLength(12);
    for (let i = 0; i < 11; i += 1) {
      expect(rows[i].principal).toBe(0);
      expect(rows[i].interest).toBeGreaterThan(0);
    }
    expect(rows[11].principal).toBe(base.principal);
    expect(rows[11].remainingBalance).toBe(0);
  });

  it('bullet is a single maturity payment (distinct from interest_only)', () => {
    const bullet = generateRepaymentSchedule({ ...base, repaymentModel: 'bullet' });
    const io = generateRepaymentSchedule({ ...base, repaymentModel: 'interest_only' });
    expect(bullet).toHaveLength(1);
    expect(io).toHaveLength(12);
    expect(bullet[0].principal).toBe(base.principal);
    expect(bullet[0].interest).toBeGreaterThan(0);
    expect(bullet[0].remainingBalance).toBe(0);
    expect(bullet[0].total).toBeCloseTo(bullet[0].principal + bullet[0].interest, 2);
  });

  it('fixed_monthly_payment splits principal + flat fee evenly', () => {
    const rows = generateRepaymentSchedule({
      ...base,
      repaymentModel: 'fixed_monthly_payment',
      annualRatePercent: 10,
    });
    expect(rows).toHaveLength(12);
    expect(rows[rows.length - 1].remainingBalance).toBe(0);
    const totals = rows.reduce((s, r) => s + r.total, 0);
    expect(totals).toBeCloseTo(12_000 + 1_200, 1);
  });
});
