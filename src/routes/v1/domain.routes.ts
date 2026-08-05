import { Router } from 'express';
import * as ctrl from '../../controllers/v1/domain.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { attachInvestorProfile } from '../../middlewares/ownership.middleware.js';
import { uploadSingle } from '../../middlewares/upload.middleware.js';
import { validateMagicBytes } from '../../middlewares/magicBytes.middleware.js';
import { uploadLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { ROLES } from '../../enums/roles.js';
import {
  paginationQuery,
  createInvestorValidator,
  updateInvestorValidator,
  createInvestmentValidator,
  updateInvestmentValidator,
  markPaidValidator,
  cancelPaymentValidator,
  earlyRepaymentValidator,
  createLoanValidator,
  updateLoanValidator,
  createReportValidator,
  updateReportValidator,
  createContractValidator,
  updateContractValidator,
  idParam,
  investmentIdParam,
} from '../../validators/domain.validator.js';

const router = Router();
const admin = [authenticate, authorize(ROLES.ADMIN)];
const anyAuth = [authenticate, attachInvestorProfile];

// Investors
router.get('/investors/me', ...anyAuth, ctrl.getMyInvestor);
router.get('/investors', ...admin, paginationQuery, validate, ctrl.listInvestors);
router.post('/investors', ...admin, createInvestorValidator, validate, ctrl.createInvestor);
router.get('/investors/:id', ...admin, idParam, validate, ctrl.getInvestor);
router.patch('/investors/:id', ...admin, updateInvestorValidator, validate, ctrl.updateInvestor);
router.delete('/investors/:id', ...admin, idParam, validate, ctrl.deleteInvestor);

// Investments
router.get('/investments', ...anyAuth, paginationQuery, validate, ctrl.listInvestments);
router.post('/investments', ...admin, createInvestmentValidator, validate, ctrl.createInvestment);
router.get('/investments/:id', ...anyAuth, idParam, validate, ctrl.getInvestment);
router.patch(
  '/investments/:id',
  ...admin,
  updateInvestmentValidator,
  validate,
  ctrl.updateInvestment,
);
router.delete('/investments/:id', ...admin, idParam, validate, ctrl.deleteInvestment);
router.post(
  '/investments/:id/regenerate-schedule',
  ...admin,
  idParam,
  validate,
  ctrl.regenerateSchedule,
);
router.post(
  '/investments/:id/early-repayment',
  ...admin,
  earlyRepaymentValidator,
  validate,
  ctrl.earlyRepayment,
);
router.get('/investments/:id/payments', ...anyAuth, idParam, validate, ctrl.listInvestmentPayments);

// Payments / schedule
router.get('/payments', ...anyAuth, paginationQuery, validate, ctrl.listPayments);
router.post('/payments/:id/mark-paid', ...admin, markPaidValidator, validate, ctrl.markPaymentPaid);
router.post('/payments/:id/cancel', ...admin, cancelPaymentValidator, validate, ctrl.cancelPayment);

// Loans
router.get('/loans', ...anyAuth, paginationQuery, validate, ctrl.listLoans);
router.post('/loans', ...admin, createLoanValidator, validate, ctrl.createLoan);
router.get('/loans/:id', ...anyAuth, idParam, validate, ctrl.getLoan);
router.patch('/loans/:id', ...admin, updateLoanValidator, validate, ctrl.updateLoan);
router.delete('/loans/:id', ...admin, idParam, validate, ctrl.deleteLoan);

// Dashboard + timeline
router.get('/dashboard/admin', ...admin, ctrl.adminDashboard);
router.get('/dashboard/investor', ...anyAuth, ctrl.investorDashboard);
router.get('/timeline', ...anyAuth, paginationQuery, validate, ctrl.listTimeline);

// Reports
router.get('/reports', ...anyAuth, paginationQuery, validate, ctrl.listReports);
router.post(
  '/reports',
  ...admin,
  uploadLimiter,
  uploadSingle('file'),
  validateMagicBytes('file'),
  createReportValidator,
  validate,
  ctrl.createReport,
);
router.get('/reports/:id', ...anyAuth, idParam, validate, ctrl.getReport);
router.get('/reports/:id/download', ...anyAuth, idParam, validate, ctrl.downloadReport);
router.patch('/reports/:id', ...admin, updateReportValidator, validate, ctrl.updateReport);
router.delete('/reports/:id', ...admin, idParam, validate, ctrl.deleteReport);

// Contracts
router.get('/contracts', ...anyAuth, paginationQuery, validate, ctrl.listContracts);
router.post(
  '/contracts',
  ...admin,
  uploadLimiter,
  uploadSingle('file'),
  validateMagicBytes('file'),
  createContractValidator,
  validate,
  ctrl.createContract,
);
router.get('/contracts/:id', ...anyAuth, idParam, validate, ctrl.getContract);
router.get('/contracts/:id/download', ...anyAuth, idParam, validate, ctrl.downloadContract);
router.patch('/contracts/:id', ...admin, updateContractValidator, validate, ctrl.updateContract);
router.delete('/contracts/:id', ...admin, idParam, validate, ctrl.deleteContract);

// Exports
router.get(
  '/exports/payments/:investmentId',
  ...anyAuth,
  investmentIdParam,
  validate,
  ctrl.exportPayments,
);

export default router;
