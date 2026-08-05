import { ApiError } from '../utils/ApiError.js';
import { INVESTMENT_STATUS, PAYMENT_STATUS, TIMELINE_EVENT_TYPE } from '../enums/domain.js';
import {
  calculateFixedMonthlyPayment,
  calculateMonthlyPayment,
  generateRepaymentSchedule,
  regenerateRemainingSchedule,
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
import { emitPortfolioRefresh } from '../sockets/emitter.js';
import { TimelineCopy } from '../utils/timeline.i18n.js';

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

function softDeleteSet(actorId?: string) {
  return {
    isDeleted: true,
    deletedAt: new Date(),
    ...(actorId ? { deletedBy: actorId, updatedBy: actorId } : {}),
  };
}

/** Fixed monthly payment does not support grace periods or balloon amounts. */
function assertFixedMonthlyCompatible(
  model: string,
  gracePeriodMonths: number,
  balloonAmount: number,
) {
  if (model !== 'fixed_monthly_payment') return;
  if (gracePeriodMonths > 0 || balloonAmount > 0) {
    throw ApiError.badRequest(
      'fixed_monthly_payment does not support gracePeriodMonths or balloonAmount',
    );
  }
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
  if (repaymentModel === 'bullet') {
    // Single maturity payment: principal + simple accrued fee over term
    const monthlyRate = rate / 100 / 12;
    return (
      Math.round((principal + principal * monthlyRate * termMonths + Number.EPSILON) * 100) / 100
    );
  }
  if (repaymentModel === 'interest_only') {
    return Math.round((principal * (rate / 100 / 12) + Number.EPSILON) * 100) / 100;
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

    const repaymentModel = input.repaymentModel || 'amortizing';
    const gracePeriodMonths = Number(input.gracePeriodMonths || 0);
    const balloonAmount = Number(input.balloonAmount || 0);
    assertFixedMonthlyCompatible(repaymentModel, gracePeriodMonths, balloonAmount);
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
        gracePeriodMonths,
        balloonAmount,
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
      const loanCopy = TimelineCopy.loanFunded(investor.name);
      await this.timeline.create({
        type: TIMELINE_EVENT_TYPE.LOAN_FUNDED,
        title: loanCopy.title,
        description: loanCopy.description,
        date: startDate,
        amount: principal,
        status: 'completed',
        investor: investor._id,
        investment: investment._id,
      });
    }

    const startedCopy = TimelineCopy.investmentStarted(principal);
    await this.timeline.create({
      type: TIMELINE_EVENT_TYPE.INVESTMENT_STARTED,
      title: startedCopy.title,
      description: startedCopy.description,
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

    emitPortfolioRefresh({
      investorId: String(investor._id),
      investmentId: String(investment._id),
      type: 'investment.create',
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

    {
      const model = String(update.repaymentModel ?? existing.repaymentModel);
      const grace = Number(
        update.gracePeriodMonths !== undefined
          ? update.gracePeriodMonths
          : existing.gracePeriodMonths || 0,
      );
      const balloon = Number(
        update.balloonAmount !== undefined ? update.balloonAmount : existing.balloonAmount || 0,
      );
      assertFixedMonthlyCompatible(model, grace, balloon);
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

    emitPortfolioRefresh({
      investorId: String(existing.investor),
      investmentId: id,
      type: 'investment.update',
    });

    return this.getById(id);
  }

  async remove(id: string, actorId?: string) {
    const doc = await this.investments.findById(id);
    if (!doc) throw ApiError.notFound('Investment not found');
    const investorId = String(doc.investor);
    const cascade = softDeleteSet(actorId);

    // Cascade soft-delete so schedules, timeline, and loans never orphan
    await Promise.all([
      this.payments.model.updateMany(
        { investment: id, isDeleted: { $ne: true } },
        { $set: cascade },
      ),
      this.timeline.model.updateMany(
        { investment: id, isDeleted: { $ne: true } },
        { $set: cascade },
      ),
      this.loans.model.updateMany({ investment: id, isDeleted: { $ne: true } }, { $set: cascade }),
      this.investments.softDelete(id, actorId),
    ]);

    await this.investorService.syncTotals(investorId);
    await this.audit?.log({
      actor: actorId,
      action: 'investment.delete',
      resource: 'investment',
      resourceId: id,
    });

    emitPortfolioRefresh({
      investorId,
      investmentId: id,
      type: 'investment.delete',
    });

    return { success: true };
  }

  /** Active (non-deleted) investment ids — used to keep payments/timeline consistent. */
  private async activeInvestmentIds(investorScopeId?: string | null): Promise<unknown[]> {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) filter.investor = investorScopeId;
    const docs = await this.investments.model.find(filter).select('_id').lean();
    return docs.map((d: any) => d._id);
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
    const paid = existing.data
      .filter((p: any) => ['completed', 'partially_paid'].includes(p.status))
      .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));
    const lastPaidSeq = paid.reduce((m: number, p: any) => Math.max(m, p.sequence || 0), 0);
    // Always use live outstanding balance — schedule remainingBalance on a
    // partially_paid row assumes the installment was paid in full.
    const remainingPrincipalNum = Number(investment.outstandingBalance);
    const safeRemaining =
      Number.isFinite(remainingPrincipalNum) && remainingPrincipalNum >= 0
        ? remainingPrincipalNum
        : Number(investment.principal) || 0;

    await this.payments.deleteUnpaidByInvestment(investmentId);

    const fromSequence = lastPaidSeq + 1;
    if (safeRemaining <= 0) {
      await this.syncScheduleTimelineEvents(investment, []);
      await this.refreshInvestmentPaymentMeta(investmentId);
      emitPortfolioRefresh({
        investorId: String(investment.investor),
        investmentId,
        type: 'schedule.regenerate',
      });
      return this.listPayments(investmentId);
    }

    // Prefer original remaining term; if exhausted (e.g. early repayment), rebuild from remaining principal
    let remainingTerm = Number(investment.termMonths) - lastPaidSeq;
    if (remainingTerm <= 0) {
      const monthly = Number(investment.monthlyPayment) || 0;
      remainingTerm =
        monthly > 0
          ? Math.max(1, Math.ceil(safeRemaining / monthly))
          : Math.max(1, Number(investment.termMonths) || 1);
    }

    const rows = regenerateRemainingSchedule({
      principal: safeRemaining,
      remainingPrincipal: safeRemaining,
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
    } else {
      await this.syncScheduleTimelineEvents(investment, []);
    }
    await this.refreshInvestmentPaymentMeta(investmentId);
    emitPortfolioRefresh({
      investorId: String(investment.investor),
      investmentId,
      type: 'schedule.regenerate',
    });
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
        const note = p.dateAdjustmentNote || '';
        let copy = TimelineCopy.installment(
          p.sequence,
          Number(p.principal),
          Number(p.interest),
          note,
        );

        if (p.status === PAYMENT_STATUS.UPCOMING) {
          type = TIMELINE_EVENT_TYPE.UPCOMING_PAYMENT;
          status = 'upcoming';
          copy = TimelineCopy.nextPayment(Number(p.principal), Number(p.interest), note);
        } else if (p.status === PAYMENT_STATUS.OVERDUE) {
          type = TIMELINE_EVENT_TYPE.OVERDUE_PAYMENT;
          status = 'overdue';
          copy = TimelineCopy.overdueInstallment(
            p.sequence,
            Number(p.principal),
            Number(p.interest),
            note,
          );
        } else if (p.status === PAYMENT_STATUS.SCHEDULED || p.status === PAYMENT_STATUS.FUTURE) {
          status = p.status === PAYMENT_STATUS.SCHEDULED ? 'upcoming' : 'future';
          copy = TimelineCopy.scheduledInstallment(
            p.sequence,
            Number(p.principal),
            Number(p.interest),
            note,
          );
        }

        return {
          type,
          title: copy.title,
          description: copy.description,
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
    const activeIds = await this.activeInvestmentIds(investorScopeId);
    if (!activeIds.length) {
      return {
        data: [],
        meta: { page: 1, limit: 0, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }

    const filter: Record<string, unknown> = {
      investment: { $in: activeIds },
    };
    if (investorScopeId) filter.investor = investorScopeId;
    else if (query.investorId) filter.investor = query.investorId;
    if (query.investmentId) {
      const wanted = String(query.investmentId);
      if (!activeIds.some((id) => String(id) === wanted)) {
        return {
          data: [],
          meta: { page: 1, limit: 0, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        };
      }
      filter.investment = query.investmentId;
    }
    if (query.status) filter.status = query.status;

    const result = await this.payments.findMany(filter, {
      page: query.page,
      limit: query.limit || 500,
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
        const closed = TimelineCopy.loanFullyRepaid();
        await this.timeline.create({
          type: TIMELINE_EVENT_TYPE.LOAN_CLOSED,
          title: closed.title,
          description: closed.description,
          date: paymentDate,
          amount: amountPaid,
          status: 'completed',
          investor: payment.investor,
          investment: payment.investment,
        });
      }
    }

    const payCopy = fullyPaid
      ? TimelineCopy.paymentCompleted(payment.sequence)
      : TimelineCopy.partialPayment(payment.sequence);
    await this.timeline.create({
      type: fullyPaid
        ? TIMELINE_EVENT_TYPE.COMPLETED_PAYMENT
        : TIMELINE_EVENT_TYPE.INTEREST_PAYMENT,
      title: payCopy.title,
      description: payCopy.description,
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
      const inv = await this.investments.findById(String(payment.investment));
      if (inv) {
        const remaining = await this.payments.findByInvestment(String(payment.investment));
        await this.syncScheduleTimelineEvents(inv, remaining.data);
      }
    }

    await this.audit?.log({
      actor: actorId,
      action: 'payment.mark_paid',
      resource: 'payment',
      resourceId: paymentId,
      meta: { amountPaid, status },
    });

    emitPortfolioRefresh({
      investorId: String(payment.investor),
      investmentId: String(payment.investment),
      paymentId,
      status,
      amountPaid,
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
    const investmentId = String(payment.investment);
    await this.refreshInvestmentPaymentMeta(investmentId);
    const investment = await this.investments.findById(investmentId);
    if (investment) {
      const remaining = await this.payments.findByInvestment(investmentId);
      await this.syncScheduleTimelineEvents(investment, remaining.data);
    }
    await this.audit?.log({
      actor: actorId,
      action: 'payment.cancel',
      resource: 'payment',
      resourceId: paymentId,
    });
    emitPortfolioRefresh({
      investorId: String(payment.investor),
      investmentId,
      paymentId,
      type: 'payment.cancel',
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

    const earlyCopy =
      newOutstanding <= 0
        ? TimelineCopy.loanFullyRepaid()
        : TimelineCopy.earlyRepayment(applyAmount);
    await this.timeline.create({
      type:
        newOutstanding <= 0
          ? TIMELINE_EVENT_TYPE.LOAN_CLOSED
          : TIMELINE_EVENT_TYPE.COMPLETED_PAYMENT,
      title: earlyCopy.title,
      description: earlyCopy.description,
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
      await this.syncScheduleTimelineEvents(investment, []);
    }

    await this.investorService.syncTotals(String(investment.investor));
    await this.audit?.log({
      actor: actorId,
      action: 'payment.early_repayment',
      resource: 'investment',
      resourceId: investmentId,
      meta: { amount: applyAmount },
    });

    emitPortfolioRefresh({
      investorId: String(investment.investor),
      investmentId,
      amount: applyAmount,
      type: 'early_repayment',
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
    const loanCopy = TimelineCopy.loanFunded(input.borrower);
    await this.timeline.create({
      type: TIMELINE_EVENT_TYPE.LOAN_FUNDED,
      title: loanCopy.title,
      description: loanCopy.description,
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
    emitPortfolioRefresh({
      investorId: String(investment.investor),
      investmentId: String(investment._id),
      type: 'loan.create',
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
    const activeIds = await this.activeInvestmentIds(investorScopeId);
    if (!activeIds.length) {
      return {
        data: [],
        meta: { page: 1, limit: 0, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }

    const filter: Record<string, unknown> = {
      investment: { $in: activeIds },
    };
    if (investorScopeId) filter.investor = investorScopeId;
    else if (query.investorId) filter.investor = query.investorId;
    if (query.investmentId) {
      const wanted = String(query.investmentId);
      if (!activeIds.some((id) => String(id) === wanted)) {
        return {
          data: [],
          meta: { page: 1, limit: 0, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        };
      }
      filter.investment = query.investmentId;
    }

    // Chronological: investment start → loan → schedule → paid → closed
    const result = await this.timeline.findMany(filter, {
      page: query.page,
      limit: query.limit || 500,
      sort: query.sort || 'date',
      lean: true,
    });

    const data = result.data
      .map(mapTimeline)
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const byDate = String(a.date).localeCompare(String(b.date));
        if (byDate !== 0) return byDate;
        return timelineTypeRank(a.type) - timelineTypeRank(b.type);
      });

    return { data, meta: result.meta || result.pagination };
  }
}

/** Stable secondary order when timestamps collide (e.g. start + loan same day). */
function timelineTypeRank(type: string): number {
  const order: Record<string, number> = {
    investment_started: 0,
    loan_funded: 1,
    scheduled_payment: 2,
    upcoming_payment: 3,
    overdue_payment: 4,
    interest_payment: 5,
    completed_payment: 6,
    loan_closed: 7,
  };
  return order[type] ?? 50;
}
