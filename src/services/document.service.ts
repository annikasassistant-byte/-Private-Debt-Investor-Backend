import fs from 'node:fs';
import path from 'node:path';
import { ApiError } from '../utils/ApiError.js';
import {
  formatBytes,
  mapContract,
  mapReport,
  mapInvestment,
  mapPayment,
} from '../utils/domain.mappers.js';
import { exportToCsv, exportInvestmentStatementPdf } from '../utils/export.helper.js';
import type {
  ReportRepository,
  ContractRepository,
  InvestmentRepository,
  PaymentRepository,
  InvestorRepository,
} from '../repositories/domain.repositories.js';
import type { AuditRepository } from '../repositories/audit.repository.js';
import env from '../config/env.js';
import ExportHistory from '../models/exportHistory.model.js';
import { PAYMENT_STATUS } from '../enums/domain.js';

function parseAssignedInvestors(input: Record<string, any>): string[] {
  if (Array.isArray(input.assignedInvestors)) {
    return input.assignedInvestors.map(String).filter(Boolean);
  }
  if (typeof input.assignedInvestors === 'string' && input.assignedInvestors.trim()) {
    try {
      const parsed = JSON.parse(input.assignedInvestors);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return input.assignedInvestors
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
  }
  if (input.investorId) return [String(input.investorId)];
  return [];
}

function resolveUploadPath(fileUrl: string): string | null {
  if (!fileUrl) return null;
  const uploadsRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  let relative = fileUrl.replace(/^\/uploads\/?/, '').replace(/^uploads\/?/, '');
  relative = relative.split('?')[0].split('#')[0];
  const absolute = path.resolve(uploadsRoot, relative);
  if (!absolute.startsWith(uploadsRoot)) return null;
  if (!fs.existsSync(absolute)) return null;
  return absolute;
}

function assertAssigned(doc: any, investorScopeId?: string | null, label = 'Document') {
  if (!investorScopeId) return;
  const assigned = (doc.assignedInvestors || []).map(String);
  if (!assigned.includes(String(investorScopeId))) {
    throw ApiError.forbidden(`${label} not assigned to you`);
  }
}

export class DocumentService {
  constructor(
    private reports: ReportRepository,
    private contracts: ContractRepository,
    private audit: AuditRepository,
  ) {}

  async listReports(query: Record<string, any> = {}, investorScopeId?: string | null) {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) {
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
    return { data: result.data.map(mapReport), meta: result.meta || result.pagination };
  }

  async createReport(input: Record<string, any>, file: any, actorId?: string) {
    if (!input.title) throw ApiError.badRequest('title is required');
    if (!file && !input.fileUrl) throw ApiError.badRequest('file is required');
    const assigned = parseAssignedInvestors(input);

    const doc = await this.reports.create(
      {
        title: input.title,
        category: input.category || 'other',
        period: input.period || '',
        fileName: file?.originalname || input.fileName || '',
        fileUrl: input.fileUrl || (file ? `/uploads/${file.filename}` : ''),
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
      meta: { assignedInvestors: assigned, fileName: doc.fileName },
    });
    return mapReport(doc);
  }

  async updateReport(id: string, input: Record<string, any>, actorId?: string) {
    const allowed = ['title', 'category', 'period', 'assignedInvestors', 'fileUrl'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.assignedInvestors !== undefined || input.investorId) {
      update.assignedInvestors = parseAssignedInvestors(input);
    }
    const doc = await this.reports.update(id, update, { actor: actorId });
    if (!doc) throw ApiError.notFound('Report not found');
    await this.audit?.log({
      actor: actorId,
      action: 'report.update',
      resource: 'report',
      resourceId: id,
    });
    return mapReport(doc);
  }

  async deleteReport(id: string, actorId?: string) {
    const doc = await this.reports.softDelete(id, actorId);
    if (!doc) throw ApiError.notFound('Report not found');
    await this.audit?.log({
      actor: actorId,
      action: 'report.delete',
      resource: 'report',
      resourceId: id,
    });
    return { success: true };
  }

  async getReport(id: string, investorScopeId?: string | null) {
    const doc = await this.reports.findById(id);
    if (!doc) throw ApiError.notFound('Report not found');
    assertAssigned(doc, investorScopeId, 'Report');
    return mapReport(doc);
  }

  async downloadReport(id: string, investorScopeId?: string | null, actorId?: string) {
    const doc = await this.reports.findById(id);
    if (!doc) throw ApiError.notFound('Report not found');
    assertAssigned(doc, investorScopeId, 'Report');
    const absolute = resolveUploadPath(doc.fileUrl);
    if (!absolute) throw ApiError.notFound('File not found on server');
    await this.audit?.log({
      actor: actorId,
      action: 'report.download',
      resource: 'report',
      resourceId: id,
    });
    return {
      absolutePath: absolute,
      fileName: doc.fileName || path.basename(absolute),
      mimeType: doc.mimeType || 'application/octet-stream',
    };
  }

  async listContracts(query: Record<string, any> = {}, investorScopeId?: string | null) {
    const filter: Record<string, unknown> = {};
    if (investorScopeId) {
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
    return { data: result.data.map(mapContract), meta: result.meta || result.pagination };
  }

  async createContract(input: Record<string, any>, file: any, actorId?: string) {
    if (!input.title) throw ApiError.badRequest('title is required');
    if (!file && !input.fileUrl) throw ApiError.badRequest('file is required');
    const assigned = parseAssignedInvestors(input);
    const doc = await this.contracts.create(
      {
        title: input.title,
        type: input.type || 'loan_agreement',
        fileName: file?.originalname || input.fileName || '',
        fileUrl: input.fileUrl || (file ? `/uploads/${file.filename}` : ''),
        mimeType: file?.mimetype || input.mimeType || '',
        sizeBytes: file?.size || Number(input.sizeBytes || 0),
        sizeLabel: formatBytes(file?.size || Number(input.sizeBytes || 0)),
        signedAt: input.signedAt ? new Date(input.signedAt) : new Date(),
        assignedInvestors: assigned,
      },
      { actor: actorId },
    );
    await this.audit?.log({
      actor: actorId,
      action: 'contract.create',
      resource: 'contract',
      resourceId: doc._id,
      meta: { assignedInvestors: assigned, fileName: doc.fileName },
    });
    return mapContract(doc);
  }

  async updateContract(id: string, input: Record<string, any>, actorId?: string) {
    const allowed = ['title', 'type', 'assignedInvestors', 'signedAt', 'fileUrl'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.assignedInvestors !== undefined || input.investorId) {
      update.assignedInvestors = parseAssignedInvestors(input);
    }
    const doc = await this.contracts.update(id, update, { actor: actorId });
    if (!doc) throw ApiError.notFound('Contract not found');
    await this.audit?.log({
      actor: actorId,
      action: 'contract.update',
      resource: 'contract',
      resourceId: id,
    });
    return mapContract(doc);
  }

  async deleteContract(id: string, actorId?: string) {
    const doc = await this.contracts.softDelete(id, actorId);
    if (!doc) throw ApiError.notFound('Contract not found');
    await this.audit?.log({
      actor: actorId,
      action: 'contract.delete',
      resource: 'contract',
      resourceId: id,
    });
    return { success: true };
  }

  async getContract(id: string, investorScopeId?: string | null) {
    const doc = await this.contracts.findById(id);
    if (!doc) throw ApiError.notFound('Contract not found');
    assertAssigned(doc, investorScopeId, 'Contract');
    return mapContract(doc);
  }

  async downloadContract(id: string, investorScopeId?: string | null, actorId?: string) {
    const doc = await this.contracts.findById(id);
    if (!doc) throw ApiError.notFound('Contract not found');
    assertAssigned(doc, investorScopeId, 'Contract');
    const absolute = resolveUploadPath(doc.fileUrl);
    if (!absolute) throw ApiError.notFound('File not found on server');
    await this.audit?.log({
      actor: actorId,
      action: 'contract.download',
      resource: 'contract',
      resourceId: id,
    });
    return {
      absolutePath: absolute,
      fileName: doc.fileName || path.basename(absolute),
      mimeType: doc.mimeType || 'application/octet-stream',
    };
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
    const soft = { isDeleted: { $ne: true } };
    const activeInvestmentIds = await this.investments.model.find(soft).distinct('_id');
    const [totalInvestors, totalInvestments, invAgg, payAgg] = await Promise.all([
      this.investors.model.countDocuments({ status: 'active', ...soft }),
      this.investments.model.countDocuments(soft),
      this.investments.model.aggregate([
        { $match: soft },
        {
          $group: {
            _id: null,
            portfolioValue: { $sum: { $ifNull: ['$principal', 0] } },
            outstanding: { $sum: { $ifNull: ['$outstandingBalance', 0] } },
            interestEarned: { $sum: { $ifNull: ['$interestEarned', 0] } },
            principalRepaid: { $sum: { $ifNull: ['$principalRepaid', 0] } },
          },
        },
      ]),
      this.payments.model.aggregate([
        {
          $match: {
            ...soft,
            investment: { $in: activeInvestmentIds },
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const inv = invAgg[0] || {
      portfolioValue: 0,
      outstanding: 0,
      interestEarned: 0,
      principalRepaid: 0,
    };
    const byStatus = Object.fromEntries(payAgg.map((r: any) => [r._id, r.count]));
    const upcoming = byStatus[PAYMENT_STATUS.UPCOMING] || 0;
    const overdue = byStatus[PAYMENT_STATUS.OVERDUE] || 0;
    const completed = byStatus[PAYMENT_STATUS.COMPLETED] || 0;
    const paymentTotal = payAgg.reduce((s: number, r: any) => s + (r.count || 0), 0);
    const collectionRate =
      paymentTotal > 0 ? Math.round((completed / paymentTotal) * 1000) / 10 : 100;
    const repaidShare =
      inv.portfolioValue > 0
        ? Math.round(((inv.principalRepaid + inv.interestEarned) / inv.portfolioValue) * 1000) / 10
        : 0;

    return {
      totalInvestors,
      totalInvestments,
      portfolioValue: inv.portfolioValue,
      outstanding: inv.outstanding,
      interestEarned: inv.interestEarned,
      principalRepaid: inv.principalRepaid,
      upcomingPayments: upcoming,
      overduePayments: overdue,
      collectionRate,
      portfolioGrowth: repaidShare,
      repaidSharePercent: repaidShare,
    };
  }

  async investorDashboard(investorId: string) {
    const invResult = await this.investments.findMany(
      { investor: investorId },
      { limit: 100, page: 1, sort: '-createdAt', lean: true },
    );
    const investments = invResult.data.map(mapInvestment).filter(Boolean);
    // Keep singular `investment` for backward compatibility (latest by createdAt).
    const investment = investments[0] || null;

    const [payResult, tlResult] = await Promise.all([
      this.investmentService.listAllPayments({ limit: 500, sort: 'dueDate' }, investorId),
      this.investmentService.listTimeline({ limit: 200, sort: 'date' }, investorId),
    ]);
    const payments = payResult.data;
    const timeline = tlResult.data;

    const nextPayment =
      payments.find((p) => p.status === 'upcoming' || p.status === 'overdue') ||
      payments.find((p) => p.status === 'scheduled' || p.status === 'future') ||
      null;

    const nextFromInvestments = investments
      .filter((inv) => inv?.nextPaymentDate)
      .sort((a, b) => String(a.nextPaymentDate).localeCompare(String(b.nextPaymentDate)))[0];

    const latestMaturity = investments.reduce((latest: string | null, inv) => {
      if (!inv?.maturityDate) return latest;
      if (!latest || inv.maturityDate > latest) return inv.maturityDate;
      return latest;
    }, null);

    const upcomingPayments = payments.filter((p) =>
      ['upcoming', 'scheduled', 'future', 'overdue'].includes(p.status),
    );

    const stats = investments.length
      ? {
          investmentAmount: investments.reduce((s, inv) => s + (inv.principal || 0), 0),
          outstandingBalance: investments.reduce((s, inv) => s + (inv.outstandingBalance || 0), 0),
          principalRepaid: investments.reduce((s, inv) => s + (inv.principalRepaid || 0), 0),
          interestEarned: investments.reduce((s, inv) => s + (inv.interestEarned || 0), 0),
          nextPaymentDate: nextFromInvestments?.nextPaymentDate || nextPayment?.dueDate || null,
          nextPaymentAmount: nextFromInvestments?.nextPaymentAmount || nextPayment?.total || 0,
          maturityDate: latestMaturity,
          status: investments.some((inv) => inv.status === 'active')
            ? 'active'
            : investment?.status || null,
          repaymentCount: payments.filter((p) => p.status === 'completed').length,
          overdueCount: payments.filter((p) => p.status === 'overdue').length,
          upcomingPaymentCount: upcomingPayments.length,
          returnedAmount: investments.reduce(
            (s, inv) => s + (inv.principalRepaid || 0) + (inv.interestEarned || 0),
            0,
          ),
          investmentCount: investments.length,
        }
      : null;

    return { investment, investments, payments, timeline, stats };
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
    actorId?: string,
  ) {
    const investment = await this.investments.findById(investmentId);
    if (!investment) throw ApiError.notFound('Investment not found');
    if (investorScopeId && String(investment.investor) !== String(investorScopeId)) {
      throw ApiError.forbidden('You can only export your own data');
    }

    const investor = await this.investors.findById(String(investment.investor));
    const result = await this.payments.findByInvestment(investmentId);
    const mappedPayments = result.data.map(mapPayment).filter(Boolean);
    const rows = mappedPayments.map((p: any) => ({
      'Due Date': p.dueDate,
      'Payment Date': p.paymentDate || '',
      Principal: p.principal,
      'Financing Fee': p.interest,
      'Total Payment': p.total,
      Balance: p.remainingBalance,
      Status: p.status,
    }));

    const mappedInvestment = mapInvestment(investment);
    let content: Buffer | string;
    let mimeType: string;
    let filename: string;

    if (format === 'pdf') {
      content = await exportInvestmentStatementPdf({
        investorName: investor?.name || investment.investorName || 'Investor',
        investment: mappedInvestment,
        payments: mappedPayments,
      });
      mimeType = 'application/pdf';
      filename = `statement-${investmentId}.pdf`;
    } else {
      content = exportToCsv(rows);
      mimeType = 'text/csv';
      filename = `payments-${investmentId}.csv`;
    }

    if (actorId) {
      await ExportHistory.create({
        user: actorId,
        investor: investment.investor,
        investment: investment._id,
        format,
        type: 'payment_schedule',
        filename,
        meta: { rowCount: rows.length },
      });
    }

    return {
      content,
      mimeType,
      filename,
      encoding: format === 'pdf' ? ('buffer' as const) : ('utf8' as const),
      meta: mappedInvestment,
    };
  }
}
