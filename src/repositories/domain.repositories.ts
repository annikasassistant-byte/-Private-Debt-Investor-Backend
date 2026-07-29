import Investor from '../models/investor.model.js';
import Investment from '../models/investment.model.js';
import Loan from '../models/loan.model.js';
import Payment from '../models/payment.model.js';
import Report from '../models/report.model.js';
import Contract from '../models/contract.model.js';
import TimelineEvent from '../models/timelineEvent.model.js';
import { BaseRepository } from './base.repository.js';

export class InvestorRepository extends BaseRepository {
  constructor() {
    super(Investor, 'Investor');
  }

  findByUserId(userId: string) {
    return this.findOne({ user: userId });
  }

  findByEmail(email: string, options: { includeDeleted?: boolean } = {}) {
    return this.findOne(
      {
        email: String(email || '')
          .trim()
          .toLowerCase(),
      },
      { includeDeleted: options.includeDeleted },
    );
  }
}

export class InvestmentRepository extends BaseRepository {
  constructor() {
    super(Investment, 'Investment');
  }
}

export class LoanRepository extends BaseRepository {
  constructor() {
    super(Loan, 'Loan');
  }
}

export class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment, 'Payment');
  }

  findByInvestment(investmentId: string, options: Record<string, unknown> = {}) {
    return this.findMany(
      { investment: investmentId },
      {
        sort: 'sequence',
        limit: 500,
        page: 1,
        lean: true,
        ...options,
      },
    );
  }

  deleteUnpaidByInvestment(investmentId: string) {
    return this.model.deleteMany({
      investment: investmentId,
      status: { $nin: ['completed', 'partially_paid'] },
    });
  }
}

export class ReportRepository extends BaseRepository {
  constructor() {
    super(Report, 'Report');
  }
}

export class ContractRepository extends BaseRepository {
  constructor() {
    super(Contract, 'Contract');
  }
}

export class TimelineRepository extends BaseRepository {
  constructor() {
    super(TimelineEvent, 'TimelineEvent');
  }
}
