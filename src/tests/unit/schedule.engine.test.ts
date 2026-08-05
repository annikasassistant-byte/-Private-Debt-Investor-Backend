import { describe, it, expect } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/depth_dashboard_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-characters!';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-cookie-secret-min-32-characters!!';

const { calculateMonthlyPayment, generateRepaymentSchedule } =
  await import('../../utils/schedule.engine.js');

describe('schedule.engine', () => {
  const base = {
    principal: 12_000,
    annualRatePercent: 12,
    termMonths: 12,
    startDate: '2026-01-15T00:00:00.000Z',
    paymentDay: 15,
    paymentDatePolicy: 'keep_contractual',
  };

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
