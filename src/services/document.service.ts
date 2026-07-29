import { ApiError } from '../utils/ApiError.js';
import { formatBytes, mapContract, mapReport } from '../utils/domain.mappers.js';
import { exportToCsv, exportToPdf } from '../utils/export.helper.js';
import type {
  ReportRepository,
  ContractRepository,
  InvestmentRepository,
  PaymentRepository,
  InvestorRepository,
} from '../repositories/domain.repositories.js';
import type { AuditRepository } from '../repositories/audit.repository.js';
import { mapInvestment, mapPayment } from '../utils/domain.mappers.js';

export class DocumentService {
  constructor(
    private reports: ReportRepository,
    private contracts: ContractRepository,
    private audit: AuditRepository,
  ) {}

  async listReports(query: Record<string, any> = {}, investorScopeId?: string | null) {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) {
      // BUG-005: default-deny — investors only see explicitly assigned docs
      filter.assignedInvestors = investorScopeId;
    }
    if (query.category) filter.category = query.category;
    const result = await this.reports.findMany(filter, {
      page: query.page,
      limit: query.limit,
      sort: query.sort || '-uploadedAt',
      search: query.search,
      searchFields: ['title', 'period'],
      lean: true,
    });
    return {
      data: result.data.map(mapReport),
      meta: (result as any).meta || (result as any).pagination,
    };
  }

  async createReport(input: Record<string, any>, file: any, actorId?: string) {
    if (!input.title) throw ApiError.badRequest('title is required');
    const assigned = Array.isArray(input.assignedInvestors)
      ? input.assignedInvestors
      : input.investorId
        ? [input.investorId]
        : [];

    const doc = await this.reports.create(
      {
        title: input.title,
        category: input.category || 'other',
        period: input.period || '',
        fileName: file?.originalname || input.fileName || '',
        fileUrl: input.fileUrl || (file ? `/uploads/documents/${file.filename}` : ''),
        mimeType: file?.mimetype || input.mimeType || '',
        sizeBytes: file?.size || Number(input.sizeBytes || 0),
        sizeLabel: formatBytes(file?.size || Number(input.sizeBytes || 0)),
        uploadedAt: new Date(),
        assignedInvestors: assigned,
      },
      { actor: actorId },
    );
    await this.audit?.log({
      actor: actorId,
      action: 'report.create',
      resource: 'report',
      resourceId: doc._id,
    });
    return mapReport(doc);
  }

  async updateReport(id: string, input: Record<string, any>, actorId?: string) {
    const allowed = ['title', 'category', 'period', 'assignedInvestors', 'fileUrl'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.investorId) update.assignedInvestors = [input.investorId];
    const doc = await this.reports.update(id, update, { actor: actorId });
    if (!doc) throw ApiError.notFound('Report not found');
    return mapReport(doc);
  }

  async deleteReport(id: string, actorId?: string) {
    const doc = await this.reports.softDelete(id, actorId);
    if (!doc) throw ApiError.notFound('Report not found');
    return { success: true };
  }

  async getReport(id: string, investorScopeId?: string | null) {
    const doc = await this.reports.findById(id);
    if (!doc) throw ApiError.notFound('Report not found');
    if (investorScopeId) {
      const assigned = (doc.assignedInvestors || []).map(String);
      if (!assigned.includes(String(investorScopeId))) {
        throw ApiError.forbidden('Report not assigned to you');
      }
    }
    return mapReport(doc);
  }

  async listContracts(query: Record<string, any> = {}, investorScopeId?: string | null) {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) {
      // BUG-005: default-deny — investors only see explicitly assigned docs
      filter.assignedInvestors = investorScopeId;
    }
    if (query.type) filter.type = query.type;
    const result = await this.contracts.findMany(filter, {
      page: query.page,
      limit: query.limit,
      sort: query.sort || '-signedAt',
      search: query.search,
      searchFields: ['title'],
      lean: true,
    });
    return {
      data: result.data.map(mapContract),
      meta: (result as any).meta || (result as any).pagination,
    };
  }

  async createContract(input: Record<string, any>, file: any, actorId?: string) {
    if (!input.title) throw ApiError.badRequest('title is required');
    const assigned = Array.isArray(input.assignedInvestors)
      ? input.assignedInvestors
      : input.investorId
        ? [input.investorId]
        : [];
    const doc = await this.contracts.create(
      {
        title: input.title,
        type: input.type || 'loan_agreement',
        fileName: file?.originalname || input.fileName || '',
        fileUrl: input.fileUrl || (file ? `/uploads/documents/${file.filename}` : ''),
        mimeType: file?.mimetype || input.mimeType || '',
        sizeBytes: file?.size || Number(input.sizeBytes || 0),
        sizeLabel: formatBytes(file?.size || Number(input.sizeBytes || 0)),
        signedAt: input.signedAt ? new Date(input.signedAt) : new Date(),
        assignedInvestors: assigned,
      },
      { actor: actorId },
    );
    return mapContract(doc);
  }

  async updateContract(id: string, input: Record<string, any>, actorId?: string) {
    const allowed = ['title', 'type', 'assignedInvestors', 'signedAt', 'fileUrl'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.investorId) update.assignedInvestors = [input.investorId];
    const doc = await this.contracts.update(id, update, { actor: actorId });
    if (!doc) throw ApiError.notFound('Contract not found');
    return mapContract(doc);
  }

  async deleteContract(id: string, actorId?: string) {
    const doc = await this.contracts.softDelete(id, actorId);
    if (!doc) throw ApiError.notFound('Contract not found');
    return { success: true };
  }

  async getContract(id: string, investorScopeId?: string | null) {
    const doc = await this.contracts.findById(id);
    if (!doc) throw ApiError.notFound('Contract not found');
    if (investorScopeId) {
      const assigned = (doc.assignedInvestors || []).map(String);
      if (!assigned.includes(String(investorScopeId))) {
        throw ApiError.forbidden('Contract not assigned to you');
      }
    }
    return mapContract(doc);
  }
}

export class DashboardService {
  constructor(
    private investors: InvestorRepository,
    private investments: InvestmentRepository,
    private payments: PaymentRepository,
    private investmentService: import('./investment.service.js').InvestmentService,
  ) {}

  async adminStats() {
    const [investors, investments, payments] = await Promise.all([
      this.investors.findMany({ status: 'active' }, { limit: 500, page: 1, lean: true }),
      this.investments.findMany({}, { limit: 500, page: 1, lean: true }),
      this.payments.findMany({}, { limit: 1000, page: 1, lean: true }),
    ]);

    const portfolioValue = investments.data.reduce(
      (s: number, i: any) => s + (i.principal || 0),
      0,
    );
    const outstanding = investments.data.reduce(
      (s: number, i: any) => s + (i.outstandingBalance || 0),
      0,
    );
    const interestEarned = investments.data.reduce(
      (s: number, i: any) => s + (i.interestEarned || 0),
      0,
    );
    const upcoming = payments.data.filter((p: any) => p.status === 'upcoming').length;
    const overdue = payments.data.filter((p: any) => p.status === 'overdue').length;
    const completed = payments.data.filter((p: any) => p.status === 'completed').length;
    const collectionRate =
      payments.data.length > 0 ? Math.round((completed / payments.data.length) * 1000) / 10 : 100;

    return {
      totalInvestors: investors.data.length,
      totalInvestments: investments.data.length,
      portfolioValue,
      outstanding,
      interestEarned,
      upcomingPayments: upcoming,
      overduePayments: overdue,
      collectionRate,
      portfolioGrowth: 0,
    };
  }

  async investorDashboard(investorId: string) {
    const invResult = await this.investments.findMany(
      { investor: investorId },
      { limit: 20, page: 1, sort: '-createdAt', lean: true },
    );
    const investment = invResult.data[0] ? mapInvestment(invResult.data[0]) : null;
    let payments: any[] = [];
    let timeline: any[] = [];
    if (investment) {
      const pay = await this.investmentService.listPayments(investment.id, investorId);
      payments = pay.data;
      const tl = await this.investmentService.listTimeline(
        { investmentId: investment.id, limit: 20 },
        investorId,
      );
      timeline = tl.data;
    }
    return { investment, payments, timeline };
  }
}

export class DomainExportService {
  constructor(
    private investments: InvestmentRepository,
    private payments: PaymentRepository,
    private investors: InvestorRepository,
  ) {}

  async exportInvestmentPayments(
    investmentId: string,
    format: 'csv' | 'pdf' = 'csv',
    investorScopeId?: string | null,
  ) {
    const investment = await this.investments.findById(investmentId);
    if (!investment) throw ApiError.notFound('Investment not found');
    if (investorScopeId && String(investment.investor) !== String(investorScopeId)) {
      throw ApiError.forbidden('You can only export your own data');
    }

    const investor = await this.investors.findById(String(investment.investor));
    const result = await this.payments.findByInvestment(investmentId);
    const rows = result.data.map((p: any) => ({
      'Due Date': mapPayment(p)?.dueDate,
      'Payment Date': mapPayment(p)?.paymentDate || '',
      Principal: mapPayment(p)?.principal,
      Interest: mapPayment(p)?.interest,
      'Total Payment': mapPayment(p)?.total,
      Balance: mapPayment(p)?.remainingBalance,
      Status: mapPayment(p)?.status,
    }));

    if (format === 'pdf') {
      const content = await exportToPdf(rows, {
        title: `Payment Schedule — ${investor?.name || investment.investorName}`,
        orientation: 'landscape',
      });
      return {
        content,
        mimeType: 'application/pdf',
        filename: `payments-${investmentId}.pdf`,
        encoding: 'buffer' as const,
        meta: mapInvestment(investment),
      };
    }

    const content = exportToCsv(rows);
    return {
      content,
      mimeType: 'text/csv',
      filename: `payments-${investmentId}.csv`,
      encoding: 'utf8' as const,
      meta: mapInvestment(investment),
    };
  }
}
