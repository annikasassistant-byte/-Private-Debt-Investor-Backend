import { body, param, query } from 'express-validator';

export const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('sort').optional().isString().isLength({ max: 64 }),
  query('search').optional().isString().isLength({ max: 200 }),
];

export const createInvestorValidator = [
  body('name').trim().notEmpty().isLength({ max: 200 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('company').optional().isString().isLength({ max: 200 }),
  body('status').optional().isIn(['active', 'inactive']),
];

export const updateInvestorValidator = [
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('company').optional().isString().isLength({ max: 200 }),
  body('status').optional().isIn(['active', 'inactive']),
];

export const createInvestmentValidator = [
  body('investorId').isMongoId(),
  body('principal').isFloat({ gt: 0 }),
  body('interestRate').isFloat({ min: 0 }),
  body('termMonths').isInt({ min: 1 }),
  body('startDate').optional().isISO8601(),
  body('paymentDay').optional().isInt({ min: 1, max: 31 }),
  body('repaymentModel')
    .optional()
    .isIn(['amortizing', 'interest_only', 'bullet', 'fixed_monthly_payment']),
  body('gracePeriodMonths').optional().isInt({ min: 0 }),
  body('balloonAmount').optional().isFloat({ min: 0 }),
  body('borrower').optional().isString().isLength({ max: 200 }),
];

export const updateInvestmentValidator = [
  param('id').isMongoId(),
  body('principal').optional().isFloat({ gt: 0 }),
  body('interestRate').optional().isFloat({ min: 0 }),
  body('termMonths').optional().isInt({ min: 1 }),
  body('status').optional().isIn(['pending', 'active', 'matured', 'closed']),
  body('paymentDay').optional().isInt({ min: 1, max: 31 }),
  body('repaymentModel')
    .optional()
    .isIn(['amortizing', 'interest_only', 'bullet', 'fixed_monthly_payment']),
  body('gracePeriodMonths').optional().isInt({ min: 0 }),
  body('balloonAmount').optional().isFloat({ min: 0 }),
  body('startDate').optional().isISO8601(),
  body('notes').optional().isString().isLength({ max: 2000 }),
];

export const markPaidValidator = [
  param('id').isMongoId(),
  body('paymentDate').optional().isISO8601(),
  body('amountPaid').optional().isFloat({ gt: 0 }),
  body('notes').optional().isString().isLength({ max: 1000 }),
];

export const cancelPaymentValidator = [
  param('id').isMongoId(),
  body('notes').optional().isString().isLength({ max: 1000 }),
];

export const earlyRepaymentValidator = [
  param('id').isMongoId(),
  body('amount').isFloat({ gt: 0 }),
  body('interestPortion').optional().isFloat({ min: 0 }),
  body('paymentDate').optional().isISO8601(),
  body('notes').optional().isString().isLength({ max: 1000 }),
];

export const createLoanValidator = [
  body('investmentId').isMongoId(),
  body('borrower').trim().notEmpty().isLength({ max: 200 }),
  body('amount').optional().isFloat({ gt: 0 }),
  body('rate').optional().isFloat({ min: 0 }),
  body('fundedAt').optional().isISO8601(),
  body('notes').optional().isString().isLength({ max: 1000 }),
];

export const updateLoanValidator = [
  param('id').isMongoId(),
  body('borrower').optional().trim().notEmpty().isLength({ max: 200 }),
  body('amount').optional().isFloat({ gt: 0 }),
  body('rate').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['pending', 'active', 'matured', 'closed']),
  body('fundedAt').optional().isISO8601(),
  body('notes').optional().isString().isLength({ max: 1000 }),
];

export const createReportValidator = [
  body('title').trim().notEmpty().isLength({ max: 300 }),
  body('category').optional().isIn(['monthly', 'quarterly', 'annual', 'kpi', 'other']),
  body('period').optional().isString().isLength({ max: 100 }),
  body('investorId').optional().isMongoId(),
  body('assignedInvestors').optional(),
];

export const updateReportValidator = [
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty().isLength({ max: 300 }),
  body('category').optional().isIn(['monthly', 'quarterly', 'annual', 'kpi', 'other']),
  body('period').optional().isString().isLength({ max: 100 }),
  body('investorId').optional().isMongoId(),
  body('assignedInvestors').optional(),
];

export const createContractValidator = [
  body('title').trim().notEmpty().isLength({ max: 300 }),
  body('type').optional().isIn(['loan_agreement', 'subordinated_loan', 'amendment', 'additional']),
  body('investorId').optional().isMongoId(),
  body('assignedInvestors').optional(),
  body('signedAt').optional().isISO8601(),
];

export const updateContractValidator = [
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty().isLength({ max: 300 }),
  body('type').optional().isIn(['loan_agreement', 'subordinated_loan', 'amendment', 'additional']),
  body('investorId').optional().isMongoId(),
  body('assignedInvestors').optional(),
  body('signedAt').optional().isISO8601(),
];

export const idParam = [param('id').isMongoId()];
export const investmentIdParam = [param('investmentId').isMongoId()];
