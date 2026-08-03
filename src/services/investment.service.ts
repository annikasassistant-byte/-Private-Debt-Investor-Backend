import { ApiError } from '../utils/ApiError.js';
import { INVESTMENT_STATUS, PAYMENT_STATUS, TIMELINE_EVENT_TYPE } from '../enums/domain.js';
import {
  calculateFixedMonthlyPayment,
  calculateMonthlyPayment,
  generateRepaymentSchedule,
  regenerateRemainingSchedule,
  type RepaymentModel,
} from '../utils/schedule.engine.js';
import { resolvePaymentDatePolicy } from '../utils/businessCalendar.js';
import env from '../config/env.js';
import { mapInvestment, mapPayment, mapLoan, mapTimeline } from '../utils/domain.mappers.js';
import type {
  InvestorRepository,
  InvestmentRepository,
  LoanRepository,
  PaymentRepository,
  TimelineRepository,
} from '../repositories/domain.repositories.js';
import type { AuditRepository } from '../repositories/audit.repository.js';
import type { InvestorService } from './investor.service.js';
import { emitDomainEvent } from '../sockets/emitter.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function clampPaymentDay(day: number) {
  return Math.min(31, Math.max(1, Math.floor(Number(day) || 15)));
}

function resolveMonthlyPaymentAmount(
  principal: number,
  rate: number,
  termMonths: number,
  repaymentModel?: string | null,
) {
  if (repaymentModel === 'fixed_monthly_payment') {
    return calculateFixedMonthlyPayment(principal, rate, termMonths);
  }
  return calculateMonthlyPayment(principal, rate, termMonths);
}

export class InvestmentService {
  constructor(
    private investments: InvestmentRepository,
    private investors: InvestorRepository,
    private payments: PaymentRepository,
    private loans: LoanRepository,
    private timeline: TimelineRepository,
    private investorService: InvestorService,
    private audit: AuditRepository,
  ) {}

  async list(query: Record<string, any> = {}, investorScopeId?: string | null) {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) filter.investor = investorScopeId;
    else if (query.investorId) filter.investor = query.investorId;
    if (query.status) filter.status = query.status;

    const result = await this.investments.findMany(filter, {
      page: query.page,
      limit: query.limit,
      sort: query.sort || '-createdAt',
      search: query.search,
      searchFields: ['investorName', 'notes'],
      lean: true,
    });
    return { data: result.data.map(mapInvestment), meta: result.meta || result.pagination };
  }

  async getById(id: string, investorScopeId?: string | null) {
    const doc = await this.investments.findById(id);
    if (!doc) throw ApiError.notFound('Investment not found');
    if (investorScopeId && String(doc.investor) !== String(investorScopeId)) {
      throw ApiError.forbidden('You can only access your own investments');
    }
    return mapInvestment(doc);
  }

  async create(input: Record<string, any>, actorId?: string) {
    const investor = await this.investors.findById(input.investorId);
    if (!investor) throw ApiError.notFound('Investor not found');

    const principal = Number(input.principal);
    const interestRate = Number(input.interestRate);
    const termMonths = Number(input.termMonths);
    const startDate = new Date(input.startDate || Date.now());
    const paymentDay = Number(input.paymentDay || startDate.getUTCDate());

    if (!(principal > 0) || !(interestRate >= 0) || !(termMonths > 0)) {
      throw ApiError.badRequest('Invalid principal, interestRate or termMonths');
    }

    const repaymentModel = (input.repaymentModel || 'amortizing') as RepaymentModel;
    const monthlyPayment = resolveMonthlyPaymentAmount(
      principal,
      interestRate,
      termMonths,
      repaymentModel,
    );
    const maturityDate = addMonths(startDate, termMonths);

    const investment = await this.investments.create(
      {
        investor: investor._id,
        investorName: investor.name,
        principal,
        interestRate,
        termMonths,
        monthlyPayment,
        outstandingBalance: principal,
        interestEarned: 0,
        principalRepaid: 0,
        status: input.status || INVESTMENT_STATUS.ACTIVE,
        startDate,
        maturityDate,
        paymentDay: clampPaymentDay(paymentDay),
        repaymentModel,
        gracePeriodMonths: Number(input.gracePeriodMonths || 0),
        balloonAmount: Number(input.balloonAmount || 0),
        notes: input.notes || '',
      },
      { actor: actorId },
    );

    await this.generateSchedule(String(investment._id), actorId);

    if (input.borrower) {
      await this.loans.create(
        {
          investment: investment._id,
          investor: investor._id,
          borrower: input.borrower,
          amount: principal,
          rate: interestRate,
          status: INVESTMENT_STATUS.ACTIVE,
          fundedAt: startDate,
        },
        { actor: actorId },
      );
      await this.timeline.create({
        type: TIMELINE_EVENT_TYPE.LOAN_FUNDED,
        title: 'Loan Funded',
        description: `Loan funded for ${investor.name}`,
        date: startDate,
        amount: principal,
        status: 'completed',
        investor: investor._id,
        investment: investment._id,
      });
    }

    await this.timeline.create({
      type: TIMELINE_EVENT_TYPE.INVESTMENT_STARTED,
      title: 'Investment Started',
      description: `Investment of ${principal} started`,
      date: startDate,
      amount: principal,
      status: 'completed',
      investor: investor._id,
      investment: investment._id,
    });

    await this.investorService.syncTotals(String(investor._id));
    await this.audit?.log({
      actor: actorId,
      action: 'investment.create',
      resource: 'investment',
      resourceId: investment._id,
    });

    return this.getById(String(investment._id));
  }

  async update(id: string, input: Record<string, any>, actorId?: string) {
    const existing = await this.investments.findById(id);
    if (!existing) throw ApiError.notFound('Investment not found');

    const scheduleFields = [
      'principal',
      'interestRate',
      'termMonths',
      'paymentDay',
      'repaymentModel',
      'gracePeriodMonths',
      'balloonAmount',
      'startDate',
    ];
    const needsRegen = scheduleFields.some((f) => input[f] !== undefined);

    const allowed = [...scheduleFields, 'status', 'notes', 'investorName'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) update[key] = input[key];
    }

    if (update.paymentDay !== undefined) {
      update.paymentDay = clampPaymentDay(Number(update.paymentDay));
    }

    if (
      update.principal !== undefined ||
      update.interestRate !== undefined ||
      update.termMonths !== undefined ||
      update.repaymentModel !== undefined
    ) {
      const principal = Number(update.principal ?? existing.principal);
      const rate = Number(update.interestRate ?? existing.interestRate);
      const term = Number(update.termMonths ?? existing.termMonths);
      const model = String(update.repaymentModel ?? existing.repaymentModel);
      update.monthlyPayment = resolveMonthlyPaymentAmount(principal, rate, term, model);
      if (update.startDate || update.termMonths) {
        const start = new Date((update.startDate as Date) || existing.startDate);
        update.maturityDate = addMonths(start, term);
      }
    }

    const doc = await this.investments.update(id, update, { actor: actorId });
    if (!doc) throw ApiError.notFound('Investment not found');

    if (needsRegen) {
      await this.regenerateSchedule(id, actorId);
    }

    await this.investorService.syncTotals(String(existing.investor));
    await this.audit?.log({
      actor: actorId,
      action: 'investment.update',
      resource: 'investment',
      resourceId: id,
    });
    return this.getById(id);
  }

  async remove(id: string, actorId?: string) {
    const doc = await this.investments.findById(id);
    if (!doc) throw ApiError.notFound('Investment not found');
    await this.investments.softDelete(id, actorId);
    await this.investorService.syncTotals(String(doc.investor));
    return { success: true };
  }

  async generateSchedule(investmentId: string, _actorId?: string) {
    const investment = await this.investments.findById(investmentId);
    if (!investment) throw ApiError.notFound('Investment not found');

    await this.payments.model.deleteMany({ investment: investmentId });

    const rows = generateRepaymentSchedule({
      principal: investment.principal,
      annualRatePercent: investment.interestRate,
      termMonths: investment.termMonths,
      startDate: investment.startDate,
      paymentDay: investment.paymentDay,
      repaymentModel: investment.repaymentModel,
      gracePeriodMonths: investment.gracePeriodMonths,
      balloonAmount: investment.balloonAmount,
      paymentDatePolicy: resolvePaymentDatePolicy(env.PAYMENT_DATE_POLICY),
    });

    const today = startOfDay();
    const docs = rows.map((row, idx) => {
      let status = PAYMENT_STATUS.SCHEDULED;
      if (row.dueDate < today) status = PAYMENT_STATUS.OVERDUE;
      else if (idx === 0 || row.dueDate.getTime() === rows[0].dueDate.getTime()) {
        status = PAYMENT_STATUS.UPCOMING;
      } else {
        status = PAYMENT_STATUS.FUTURE;
      }
      return {
        investment: investment._id,
        investor: investment.investor,
        sequence: row.sequence,
        dueDate: row.dueDate,
        contractualDueDate: row.contractualDueDate,
        dateAdjustmentNote: row.dateAdjustmentNote || '',
        notes: row.dateAdjustmentNote || '',
        principal: row.principal,
        interest: row.interest,
        total: row.total,
        remainingBalance: row.remainingBalance,
        status,
      };
    });

    if (docs.length) {
      const inserted = await this.payments.model.insertMany(docs);
      await this.syncScheduleTimelineEvents(investment, inserted);
    }
    await this.refreshInvestmentPaymentMeta(investmentId);
    return this.listPayments(investmentId);
  }

  async regenerateSchedule(investmentId: string, _actorId?: string) {
    const investment = await this.investments.findById(investmentId);
    if (!investment) throw ApiError.notFound('Investment not found');

    const existing = await this.payments.findByInvestment(investmentId);
    const paid = existing.data.filter((p: any) =>
      ['completed', 'partially_paid'].includes(p.status),
    );
    const lastPaidSeq = paid.reduce((m: number, p: any) => Math.max(m, p.sequence || 0), 0);
    const remainingPrincipal =
      paid.length > 0
        ? paid[paid.length - 1].remainingBalance
        : investment.outstandingBalance || investment.principal;

    await this.payments.deleteUnpaidByInvestment(investmentId);

    const fromSequence = lastPaidSeq + 1;
    const remainingPrincipalNum = Number(remainingPrincipal) || 0;
    if (remainingPrincipalNum <= 0) {
      await this.refreshInvestmentPaymentMeta(investmentId);
      return this.listPayments(investmentId);
    }

    // Prefer original remaining term; if exhausted (e.g. early repayment), rebuild from remaining principal
    let remainingTerm = Number(investment.termMonths) - lastPaidSeq;
    if (remainingTerm <= 0) {
      const monthly = Number(investment.monthlyPayment) || 0;
      remainingTerm =
        monthly > 0
          ? Math.max(1, Math.ceil(remainingPrincipalNum / monthly))
          : Math.max(1, Number(investment.termMonths) || 1);
    }

    const rows = regenerateRemainingSchedule({
      principal: remainingPrincipalNum,
      remainingPrincipal: remainingPrincipalNum,
      fromSequence,
      annualRatePercent: investment.interestRate,
      termMonths: lastPaidSeq + remainingTerm,
      startDate: investment.startDate,
      paymentDay: investment.paymentDay,
      repaymentModel: investment.repaymentModel,
      gracePeriodMonths: 0,
      balloonAmount: investment.balloonAmount,
      paymentDatePolicy: resolvePaymentDatePolicy(env.PAYMENT_DATE_POLICY),
    });

    const today = startOfDay();
    let upcomingSet = false;
    const docs = rows.map((row) => {
      let status = PAYMENT_STATUS.FUTURE;
      if (row.dueDate < today) status = PAYMENT_STATUS.OVERDUE;
      else if (!upcomingSet) {
        status = PAYMENT_STATUS.UPCOMING;
        upcomingSet = true;
      }
      return {
        investment: investment._id,
        investor: investment.investor,
        sequence: row.sequence,
        dueDate: row.dueDate,
        contractualDueDate: row.contractualDueDate,
        dateAdjustmentNote: row.dateAdjustmentNote || '',
        notes: row.dateAdjustmentNote || '',
        principal: row.principal,
        interest: row.interest,
        total: row.total,
        remainingBalance: row.remainingBalance,
        status,
      };
    });

    if (docs.length) {
      const inserted = await this.payments.model.insertMany(docs);
      await this.syncScheduleTimelineEvents(investment, inserted);
    }
    await this.refreshInvestmentPaymentMeta(investmentId);
    return this.listPayments(investmentId);
  }

  /**
   * Create timeline rows for each unpaid installment (scheduled / next / overdue).
   * Replaces prior schedule-derived timeline events for the investment.
   */
  private async syncScheduleTimelineEvents(investment: any, payments: any[]) {
    await this.timeline.model.deleteMany({
      investment: investment._id,
      type: {
        $in: [
          TIMELINE_EVENT_TYPE.SCHEDULED_PAYMENT,
          TIMELINE_EVENT_TYPE.UPCOMING_PAYMENT,
          TIMELINE_EVENT_TYPE.OVERDUE_PAYMENT,
        ],
      },
    });

    const events = payments
      .filter(
        (p) =>
          ![
            PAYMENT_STATUS.COMPLETED,
            PAYMENT_STATUS.PARTIALLY_PAID,
            PAYMENT_STATUS.CANCELLED,
          ].includes(p.status),
      )
      .map((p) => {
        let type: string = TIMELINE_EVENT_TYPE.SCHEDULED_PAYMENT;
        let status: 'upcoming' | 'future' | 'overdue' = 'future';
        let title = `Installment #${p.sequence}`;

        if (p.status === PAYMENT_STATUS.UPCOMING) {
          type = TIMELINE_EVENT_TYPE.UPCOMING_PAYMENT;
          status = 'upcoming';
          title = 'Next Payment Due';
        } else if (p.status === PAYMENT_STATUS.OVERDUE) {
          type = TIMELINE_EVENT_TYPE.OVERDUE_PAYMENT;
          status = 'overdue';
          title = `Overdue · Installment #${p.sequence}`;
        } else if (p.status === PAYMENT_STATUS.SCHEDULED) {
          status = 'upcoming';
          title = `Scheduled · Installment #${p.sequence}`;
        }

        const note = p.dateAdjustmentNote ? ` ${p.dateAdjustmentNote}` : '';
        return {
          type,
          title,
          description: `Principal ${p.principal} · Financing Fee ${p.interest}.${note}`,
          date: p.dueDate,
          amount: p.total,
          status,
          investor: investment.investor,
          investment: investment._id,
          payment: p._id,
        };
      });

    if (events.length) {
      await this.timeline.model.insertMany(events);
    }
  }

  async listPayments(investmentId: string, investorScopeId?: string | null) {
    const investment = await this.investments.findById(investmentId);
    if (!investment) throw ApiError.notFound('Investment not found');
    if (investorScopeId && String(investment.investor) !== String(investorScopeId)) {
      throw ApiError.forbidden('You can only access your own payments');
    }
    await this.markOverdue(investmentId);
    const result = await this.payments.findByInvestment(investmentId);
    return { data: result.data.map(mapPayment), meta: result.meta || result.pagination };
  }

  async listAllPayments(query: Record<string, any> = {}, investorScopeId?: string | null) {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) filter.investor = investorScopeId;
    else if (query.investorId) filter.investor = query.investorId;
    if (query.investmentId) filter.investment = query.investmentId;
    if (query.status) filter.status = query.status;

    const result = await this.payments.findMany(filter, {
      page: query.page,
      limit: query.limit || 50,
      sort: query.sort || 'dueDate',
      lean: true,
    });
    return { data: result.data.map(mapPayment), meta: result.meta || result.pagination };
  }

  async markPaid(paymentId: string, input: Record<string, any> = {}, actorId?: string) {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      throw ApiError.badRequest('Payment already completed');
    }
    if (payment.status === PAYMENT_STATUS.CANCELLED) {
      throw ApiError.badRequest('Cancelled payments cannot be marked paid');
    }

    const previousPaid = Number(payment.amountPaid || 0);
    const amountPaid = Number(input.amountPaid ?? payment.total);
    if (!(amountPaid > 0)) throw ApiError.badRequest('amountPaid must be greater than 0');

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const fullyPaid = amountPaid >= Number(payment.total) - 0.009;
    const status = fullyPaid ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.PARTIALLY_PAID;

    // Allocate: interest first, then principal
    const interestPortion = Math.min(Number(payment.interest), amountPaid);
    const principalPortion = Math.max(
      0,
      Math.min(Number(payment.principal), amountPaid - interestPortion),
    );
    const priorInterest = Math.min(previousPaid, Number(payment.interest));
    const priorPrincipal = Math.max(0, previousPaid - priorInterest);
    const deltaInterest = Math.max(0, interestPortion - priorInterest);
    const deltaPrincipal = Math.max(0, principalPortion - priorPrincipal);

    await this.payments.update(paymentId, {
      paymentDate,
      amountPaid,
      status,
      notes: input.notes || payment.notes || '',
    });

    const investment = await this.investments.findById(payment.investment);
    if (investment) {
      const principalRepaid = (investment.principalRepaid || 0) + deltaPrincipal;
      const interestEarned = (investment.interestEarned || 0) + deltaInterest;
      let outstandingBalance = Math.max(
        0,
        Number(investment.outstandingBalance || 0) - deltaPrincipal,
      );
      if (fullyPaid && payment.remainingBalance != null) {
        outstandingBalance = Number(payment.remainingBalance);
      }

      await this.investments.update(String(investment._id), {
        principalRepaid,
        interestEarned,
        outstandingBalance,
        status: outstandingBalance <= 0 ? INVESTMENT_STATUS.CLOSED : investment.status,
      });
      await this.investorService.syncTotals(String(investment.investor));

      if (outstandingBalance <= 0) {
        await this.timeline.create({
          type: TIMELINE_EVENT_TYPE.LOAN_CLOSED,
          title: 'Loan Fully Repaid',
          description: 'Investment fully repaid',
          date: paymentDate,
          amount: amountPaid,
          status: 'completed',
          investor: payment.investor,
          investment: payment.investment,
        });
      }
    }

    await this.timeline.create({
      type: fullyPaid
        ? TIMELINE_EVENT_TYPE.COMPLETED_PAYMENT
        : TIMELINE_EVENT_TYPE.INTEREST_PAYMENT,
      title: fullyPaid ? 'Payment Completed' : 'Partial Payment Received',
      description: `Payment #${payment.sequence} ${fullyPaid ? 'completed' : 'partially paid'}`,
      date: paymentDate,
      amount: amountPaid,
      status: 'completed',
      investor: payment.investor,
      investment: payment.investment,
      payment: payment._id,
    });

    if (!fullyPaid) {
      await this.regenerateSchedule(String(payment.investment), actorId);
    } else {
      await this.refreshInvestmentPaymentMeta(String(payment.investment));
    }

    await this.audit?.log({
      actor: actorId,
      action: 'payment.mark_paid',
      resource: 'payment',
      resourceId: paymentId,
      meta: { amountPaid, status },
    });

    emitDomainEvent('payment', {
      investorId: String(payment.investor),
      investmentId: String(payment.investment),
      paymentId,
      status,
      amountPaid,
    });
    emitDomainEvent('timeline', {
      investorId: String(payment.investor),
      investmentId: String(payment.investment),
      type: fullyPaid ? 'completed_payment' : 'interest_payment',
    });

    return mapPayment(await this.payments.findById(paymentId));
  }

  async cancelPayment(paymentId: string, input: Record<string, any> = {}, actorId?: string) {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      throw ApiError.badRequest('Completed payments cannot be cancelled');
    }
    await this.payments.update(paymentId, {
      status: PAYMENT_STATUS.CANCELLED,
      notes: input.notes || payment.notes || 'Cancelled by administrator',
    });
    await this.refreshInvestmentPaymentMeta(String(payment.investment));
    await this.audit?.log({
      actor: actorId,
      action: 'payment.cancel',
      resource: 'payment',
      resourceId: paymentId,
    });
    return mapPayment(await this.payments.findById(paymentId));
  }

  async earlyRepayment(investmentId: string, input: Record<string, any> = {}, actorId?: string) {
    const investment = await this.investments.findById(investmentId);
    if (!investment) throw ApiError.notFound('Investment not found');

    const amount = Number(input.amount);
    if (!(amount > 0)) throw ApiError.badRequest('amount must be greater than 0');

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const outstanding = Number(investment.outstandingBalance || 0);
    const applyAmount = Math.min(amount, outstanding);
    if (applyAmount <= 0) throw ApiError.badRequest('Nothing left to repay');

    // Clear unpaid rows first so early repayment sequences stay contiguous
    await this.payments.deleteUnpaidByInvestment(investmentId);

    const existing = await this.payments.findByInvestment(investmentId);
    const lastSeq = existing.data.reduce((m: number, p: any) => Math.max(m, p.sequence || 0), 0);
    const interestPortion = Math.min(Number(input.interestPortion || 0), applyAmount);
    const principalPortion = Math.max(0, applyAmount - interestPortion);
    const newOutstanding = Math.max(0, outstanding - principalPortion);

    await this.payments.model.create({
      investment: investment._id,
      investor: investment.investor,
      sequence: lastSeq + 1,
      dueDate: paymentDate,
      paymentDate,
      principal: principalPortion,
      interest: interestPortion,
      total: applyAmount,
      remainingBalance: newOutstanding,
      amountPaid: applyAmount,
      status: PAYMENT_STATUS.COMPLETED,
      notes: input.notes || 'Early repayment',
    });

    await this.investments.update(investmentId, {
      outstandingBalance: newOutstanding,
      principalRepaid: (investment.principalRepaid || 0) + principalPortion,
      interestEarned: (investment.interestEarned || 0) + interestPortion,
      status: newOutstanding <= 0 ? INVESTMENT_STATUS.CLOSED : investment.status,
    });

    await this.timeline.create({
      type:
        newOutstanding <= 0
          ? TIMELINE_EVENT_TYPE.LOAN_CLOSED
          : TIMELINE_EVENT_TYPE.COMPLETED_PAYMENT,
      title: newOutstanding <= 0 ? 'Loan Fully Repaid' : 'Early Repayment',
      description: `Early repayment of ${applyAmount}`,
      date: paymentDate,
      amount: applyAmount,
      status: 'completed',
      investor: investment.investor,
      investment: investment._id,
    });

    if (newOutstanding > 0) {
      await this.regenerateSchedule(investmentId, actorId);
    } else {
      await this.payments.deleteUnpaidByInvestment(investmentId);
      await this.refreshInvestmentPaymentMeta(investmentId);
    }

    await this.investorService.syncTotals(String(investment.investor));
    await this.audit?.log({
      actor: actorId,
      action: 'payment.early_repayment',
      resource: 'investment',
      resourceId: investmentId,
      meta: { amount: applyAmount },
    });

    emitDomainEvent('payment', {
      investorId: String(investment.investor),
      investmentId,
      amount: applyAmount,
      type: 'early_repayment',
    });
    emitDomainEvent('timeline', {
      investorId: String(investment.investor),
      investmentId,
      type: newOutstanding <= 0 ? 'loan_closed' : 'completed_payment',
    });

    return this.getById(investmentId);
  }

  async markOverdue(investmentId?: string) {
    const today = startOfDay();
    const filter: Record<string, unknown> = {
      dueDate: { $lt: today },
      status: { $in: [PAYMENT_STATUS.SCHEDULED, PAYMENT_STATUS.UPCOMING, PAYMENT_STATUS.FUTURE] },
    };
    if (investmentId) filter.investment = investmentId;
    await this.payments.model.updateMany(filter, { $set: { status: PAYMENT_STATUS.OVERDUE } });
  }

  async refreshInvestmentPaymentMeta(investmentId: string) {
    await this.markOverdue(investmentId);
    const result = await this.payments.findByInvestment(investmentId);
    const unpaid = result.data.filter((p: any) => p.status !== PAYMENT_STATUS.COMPLETED);
    const next =
      unpaid.find(
        (p: any) => p.status === PAYMENT_STATUS.UPCOMING || p.status === PAYMENT_STATUS.OVERDUE,
      ) || unpaid[0];

    // normalize one upcoming
    if (next && next.status !== PAYMENT_STATUS.OVERDUE) {
      await this.payments.model.updateMany(
        {
          investment: investmentId,
          status: PAYMENT_STATUS.UPCOMING,
          _id: { $ne: next._id },
        },
        { $set: { status: PAYMENT_STATUS.FUTURE } },
      );
      if (next.status !== PAYMENT_STATUS.UPCOMING) {
        await this.payments.update(String(next._id), { status: PAYMENT_STATUS.UPCOMING });
      }
    }

    await this.investments.update(investmentId, {
      nextPaymentDate: next?.dueDate || null,
      nextPaymentAmount: next?.total || 0,
      monthlyPayment: next?.total || 0,
    });
  }

  // Loans
  async listLoans(query: Record<string, any> = {}, investorScopeId?: string | null) {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) filter.investor = investorScopeId;
    else if (query.investorId) filter.investor = query.investorId;
    if (query.investmentId) filter.investment = query.investmentId;
    if (query.status) filter.status = query.status;
    const result = await this.loans.findMany(filter, {
      page: query.page,
      limit: query.limit,
      sort: query.sort || '-fundedAt',
      search: query.search,
      searchFields: ['borrower'],
      lean: true,
    });
    return { data: result.data.map(mapLoan), meta: result.meta || result.pagination };
  }

  async createLoan(input: Record<string, any>, actorId?: string) {
    const investment = await this.investments.findById(input.investmentId);
    if (!investment) throw ApiError.notFound('Investment not found');
    const loan = await this.loans.create(
      {
        investment: investment._id,
        investor: investment.investor,
        borrower: input.borrower,
        amount: Number(input.amount ?? investment.principal),
        rate: Number(input.rate ?? investment.interestRate),
        status: input.status || INVESTMENT_STATUS.ACTIVE,
        fundedAt: input.fundedAt ? new Date(input.fundedAt) : new Date(),
        notes: input.notes || '',
      },
      { actor: actorId },
    );
    await this.timeline.create({
      type: TIMELINE_EVENT_TYPE.LOAN_FUNDED,
      title: 'Loan Funded',
      description: `Loan funded for ${input.borrower}`,
      date: loan.fundedAt || new Date(),
      amount: loan.amount,
      status: 'completed',
      investor: investment.investor,
      investment: investment._id,
    });
    await this.audit?.log({
      actor: actorId,
      action: 'loan.create',
      resource: 'loan',
      resourceId: loan._id,
    });
    return mapLoan(loan);
  }

  async getLoanById(id: string, investorScopeId?: string | null) {
    const doc = await this.loans.findById(id);
    if (!doc) throw ApiError.notFound('Loan not found');
    if (investorScopeId && String(doc.investor) !== String(investorScopeId)) {
      throw ApiError.forbidden('You can only access your own loans');
    }
    return mapLoan(doc);
  }

  async updateLoan(id: string, input: Record<string, any>, actorId?: string) {
    const allowed = ['borrower', 'amount', 'rate', 'status', 'fundedAt', 'notes'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    const doc = await this.loans.update(id, update, { actor: actorId });
    if (!doc) throw ApiError.notFound('Loan not found');
    return mapLoan(doc);
  }

  async removeLoan(id: string, actorId?: string) {
    const doc = await this.loans.softDelete(id, actorId);
    if (!doc) throw ApiError.notFound('Loan not found');
    return { success: true };
  }

  async listTimeline(query: Record<string, any> = {}, investorScopeId?: string | null) {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) filter.investor = investorScopeId;
    else if (query.investorId) filter.investor = query.investorId;
    if (query.investmentId) filter.investment = query.investmentId;
    const result = await this.timeline.findMany(filter, {
      page: query.page,
      limit: query.limit || 50,
      sort: query.sort || '-date',
      lean: true,
    });
    return { data: result.data.map(mapTimeline), meta: result.meta || result.pagination };
  }
}
