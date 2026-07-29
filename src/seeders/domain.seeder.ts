import logger from '../config/logger.js';
import { ROLES } from '../enums/roles.js';
import { INVESTOR_STATUS } from '../enums/domain.js';

/**
 * Seed demo investor + investment + loan for local/dev environments.
 * Idempotent — skips if demo investor email already exists.
 */
export async function seedDomain(deps, overrides = {}) {
  const { investorService, investmentService, investorRepository, roleRepository } = deps;

  const email = (overrides.email || 'investor@depthdashboard.local').trim().toLowerCase();
  const existing = await investorRepository.findByEmail(email, { includeDeleted: true });
  if (existing && !existing.isDeleted) {
    logger.info('Domain demo data already present', { email });
    return { investor: existing, investment: null, skipped: true };
  }

  const investorRole = await roleRepository.findBySlug(ROLES.INVESTOR);
  if (!investorRole) {
    throw new Error('Investor role missing — run role seeder first');
  }

  const investor = await investorService.create(
    {
      name: overrides.name || 'Demo Investor',
      email,
      password: overrides.password || 'ChangeMeInvestor123!',
      phone: '+49 30 1234567',
      company: 'Depth Capital Partners GmbH',
      status: INVESTOR_STATUS.ACTIVE,
    },
    overrides.actorId,
  );

  const start = new Date();
  start.setUTCDate(10);
  start.setUTCMonth(start.getUTCMonth() - 1);

  const investment = await investmentService.create(
    {
      investorId: investor.id,
      principal: 250000,
      interestRate: 7.5,
      termMonths: 24,
      paymentDay: 15,
      repaymentModel: 'amortizing',
      startDate: start.toISOString(),
      borrower: 'Nordic Logistics GmbH',
      notes: 'Seeded demo investment',
    },
    overrides.actorId,
  );

  logger.info('Domain demo data seeded', {
    investor: email,
    investmentId: investment.id,
    passwordNote: 'ChangeMeInvestor123!',
  });

  return { investor, investment, skipped: false };
}

export default seedDomain;
