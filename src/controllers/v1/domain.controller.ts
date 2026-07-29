import { container } from '../../di/container.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { MESSAGES } from '../../constants/messages.js';
import { isAdminUser } from '../../middlewares/ownership.middleware.js';

function actorId(req: any) {
  return req.user?._id || req.user?.id;
}

function investorScope(req: any): string | null {
  if (isAdminUser(req.user)) return null;
  return String(req.investor?._id || '');
}

// ---- Investors ----
export const listInvestors = asyncHandler(async (req, res) => {
  const result = await container.investorService.list(req.query);
  return ApiResponse.paginated(res, result.data, result.meta, MESSAGES.LIST_FETCHED);
});

export const getInvestor = asyncHandler(async (req, res) => {
  const data = await container.investorService.getById(req.params.id);
  return ApiResponse.ok(res, data, MESSAGES.FETCHED);
});

export const getMyInvestor = asyncHandler(async (req, res) => {
  const data = await container.investorService.getByUserId(String(actorId(req)));
  return ApiResponse.ok(res, data, MESSAGES.FETCHED);
});

export const createInvestor = asyncHandler(async (req, res) => {
  const data = await container.investorService.create(req.body, actorId(req));
  return ApiResponse.created(res, data, MESSAGES.CREATED);
});

export const updateInvestor = asyncHandler(async (req, res) => {
  const data = await container.investorService.update(req.params.id, req.body, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.UPDATED);
});

export const deleteInvestor = asyncHandler(async (req, res) => {
  const data = await container.investorService.remove(req.params.id, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.DELETED);
});

// ---- Investments ----
export const listInvestments = asyncHandler(async (req, res) => {
  const result = await container.investmentService.list(req.query, investorScope(req));
  return ApiResponse.paginated(res, result.data, result.meta, MESSAGES.LIST_FETCHED);
});

export const getInvestment = asyncHandler(async (req, res) => {
  const data = await container.investmentService.getById(req.params.id, investorScope(req));
  return ApiResponse.ok(res, data, MESSAGES.FETCHED);
});

export const createInvestment = asyncHandler(async (req, res) => {
  const data = await container.investmentService.create(req.body, actorId(req));
  return ApiResponse.created(res, data, MESSAGES.CREATED);
});

export const updateInvestment = asyncHandler(async (req, res) => {
  const data = await container.investmentService.update(req.params.id, req.body, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.UPDATED);
});

export const deleteInvestment = asyncHandler(async (req, res) => {
  const data = await container.investmentService.remove(req.params.id, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.DELETED);
});

export const regenerateSchedule = asyncHandler(async (req, res) => {
  const data = await container.investmentService.regenerateSchedule(req.params.id, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.SUCCESS);
});

// ---- Payments ----
export const listPayments = asyncHandler(async (req, res) => {
  const result = await container.investmentService.listAllPayments(req.query, investorScope(req));
  return ApiResponse.paginated(res, result.data, result.meta, MESSAGES.LIST_FETCHED);
});

export const listInvestmentPayments = asyncHandler(async (req, res) => {
  const result = await container.investmentService.listPayments(req.params.id, investorScope(req));
  return ApiResponse.ok(res, result.data, MESSAGES.LIST_FETCHED);
});

export const markPaymentPaid = asyncHandler(async (req, res) => {
  const data = await container.investmentService.markPaid(req.params.id, req.body, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.UPDATED);
});

export const cancelPayment = asyncHandler(async (req, res) => {
  const data = await container.investmentService.cancelPayment(
    req.params.id,
    req.body,
    actorId(req),
  );
  return ApiResponse.ok(res, data, MESSAGES.UPDATED);
});

export const earlyRepayment = asyncHandler(async (req, res) => {
  const data = await container.investmentService.earlyRepayment(
    req.params.id,
    req.body,
    actorId(req),
  );
  return ApiResponse.ok(res, data, MESSAGES.UPDATED);
});

export const getLoan = asyncHandler(async (req, res) => {
  const data = await container.investmentService.getLoanById(req.params.id, investorScope(req));
  return ApiResponse.ok(res, data, MESSAGES.FETCHED);
});

// ---- Loans ----
export const listLoans = asyncHandler(async (req, res) => {
  const result = await container.investmentService.listLoans(req.query, investorScope(req));
  return ApiResponse.paginated(res, result.data, result.meta, MESSAGES.LIST_FETCHED);
});

export const createLoan = asyncHandler(async (req, res) => {
  const data = await container.investmentService.createLoan(req.body, actorId(req));
  return ApiResponse.created(res, data, MESSAGES.CREATED);
});

export const updateLoan = asyncHandler(async (req, res) => {
  const data = await container.investmentService.updateLoan(req.params.id, req.body, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.UPDATED);
});

export const deleteLoan = asyncHandler(async (req, res) => {
  const data = await container.investmentService.removeLoan(req.params.id, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.DELETED);
});

// ---- Dashboard / timeline ----
export const adminDashboard = asyncHandler(async (_req, res) => {
  const data = await container.dashboardService.adminStats();
  return ApiResponse.ok(res, data, MESSAGES.FETCHED);
});

export const investorDashboard = asyncHandler(async (req, res) => {
  const scope = investorScope(req);
  const id = scope || String(req.query.investorId || '');
  if (!id) {
    const { ApiError } = await import('../../utils/ApiError.js');
    throw ApiError.badRequest('investorId is required');
  }
  const data = await container.dashboardService.investorDashboard(id);
  return ApiResponse.ok(res, data, MESSAGES.FETCHED);
});

export const listTimeline = asyncHandler(async (req, res) => {
  const result = await container.investmentService.listTimeline(req.query, investorScope(req));
  return ApiResponse.paginated(res, result.data, result.meta, MESSAGES.LIST_FETCHED);
});

// ---- Reports ----
export const listReports = asyncHandler(async (req, res) => {
  const result = await container.documentService.listReports(req.query, investorScope(req));
  return ApiResponse.paginated(res, result.data, result.meta, MESSAGES.LIST_FETCHED);
});

export const getReport = asyncHandler(async (req, res) => {
  const data = await container.documentService.getReport(req.params.id, investorScope(req));
  return ApiResponse.ok(res, data, MESSAGES.FETCHED);
});

export const createReport = asyncHandler(async (req, res) => {
  const data = await container.documentService.createReport(req.body, req.file, actorId(req));
  return ApiResponse.created(res, data, MESSAGES.CREATED);
});

export const updateReport = asyncHandler(async (req, res) => {
  const data = await container.documentService.updateReport(req.params.id, req.body, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.UPDATED);
});

export const deleteReport = asyncHandler(async (req, res) => {
  const data = await container.documentService.deleteReport(req.params.id, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.DELETED);
});

export const downloadReport = asyncHandler(async (req, res) => {
  const file = await container.documentService.downloadReport(
    req.params.id,
    investorScope(req),
    actorId(req),
  );
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  return res.sendFile(file.absolutePath);
});

// ---- Contracts ----
export const listContracts = asyncHandler(async (req, res) => {
  const result = await container.documentService.listContracts(req.query, investorScope(req));
  return ApiResponse.paginated(res, result.data, result.meta, MESSAGES.LIST_FETCHED);
});

export const getContract = asyncHandler(async (req, res) => {
  const data = await container.documentService.getContract(req.params.id, investorScope(req));
  return ApiResponse.ok(res, data, MESSAGES.FETCHED);
});

export const createContract = asyncHandler(async (req, res) => {
  const data = await container.documentService.createContract(req.body, req.file, actorId(req));
  return ApiResponse.created(res, data, MESSAGES.CREATED);
});

export const updateContract = asyncHandler(async (req, res) => {
  const data = await container.documentService.updateContract(
    req.params.id,
    req.body,
    actorId(req),
  );
  return ApiResponse.ok(res, data, MESSAGES.UPDATED);
});

export const deleteContract = asyncHandler(async (req, res) => {
  const data = await container.documentService.deleteContract(req.params.id, actorId(req));
  return ApiResponse.ok(res, data, MESSAGES.DELETED);
});

export const downloadContract = asyncHandler(async (req, res) => {
  const file = await container.documentService.downloadContract(
    req.params.id,
    investorScope(req),
    actorId(req),
  );
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  return res.sendFile(file.absolutePath);
});

// ---- Export ----
export const exportPayments = asyncHandler(async (req, res) => {
  const format = (req.query.format === 'pdf' ? 'pdf' : 'csv') as 'csv' | 'pdf';
  const exported = await container.domainExportService.exportInvestmentPayments(
    req.params.investmentId,
    format,
    investorScope(req),
    actorId(req),
  );
  res.setHeader('Content-Type', exported.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
  return res.send(exported.content);
});
