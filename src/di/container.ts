import {
  UserRepository,
  RoleRepository,
  PermissionRepository,
  RefreshTokenRepository,
  AuditRepository,
  InvestorRepository,
  InvestmentRepository,
  LoanRepository,
  PaymentRepository,
  ReportRepository,
  ContractRepository,
  TimelineRepository,
} from '../repositories/index.js';
import {
  AuthService,
  UserService,
  RoleService,
  PermissionService,
  TokenService,
  EmailService,
  CacheService,
  ExportService,
  OtpService,
  NotificationService,
  AdminBootstrapService,
  InvestorService,
  InvestmentService,
  DocumentService,
  DashboardService,
  DomainExportService,
} from '../services/index.js';

export class Container {
  constructor() {
    this.#singletons = new Map();
  }

  #singletons;

  get(name, factory) {
    if (!this.#singletons.has(name)) {
      this.#singletons.set(name, factory());
    }
    return this.#singletons.get(name);
  }

  get userRepository() {
    return this.get('userRepository', () => new UserRepository());
  }
  get roleRepository() {
    return this.get('roleRepository', () => new RoleRepository());
  }
  get permissionRepository() {
    return this.get('permissionRepository', () => new PermissionRepository());
  }
  get refreshTokenRepository() {
    return this.get('refreshTokenRepository', () => new RefreshTokenRepository());
  }
  get auditRepository() {
    return this.get('auditRepository', () => new AuditRepository());
  }
  get investorRepository() {
    return this.get('investorRepository', () => new InvestorRepository());
  }
  get investmentRepository() {
    return this.get('investmentRepository', () => new InvestmentRepository());
  }
  get loanRepository() {
    return this.get('loanRepository', () => new LoanRepository());
  }
  get paymentRepository() {
    return this.get('paymentRepository', () => new PaymentRepository());
  }
  get reportRepository() {
    return this.get('reportRepository', () => new ReportRepository());
  }
  get contractRepository() {
    return this.get('contractRepository', () => new ContractRepository());
  }
  get timelineRepository() {
    return this.get('timelineRepository', () => new TimelineRepository());
  }

  get cacheService() {
    return this.get('cacheService', () => new CacheService());
  }
  get otpService() {
    return this.get('otpService', () => new OtpService());
  }
  get emailService() {
    return this.get('emailService', () => new EmailService());
  }
  get notificationService() {
    return this.get('notificationService', () => new NotificationService());
  }
  get tokenService() {
    return this.get(
      'tokenService',
      () => new TokenService({ refreshTokenRepository: this.refreshTokenRepository }),
    );
  }

  get authService() {
    return this.get(
      'authService',
      () =>
        new AuthService({
          userRepository: this.userRepository,
          roleRepository: this.roleRepository,
          tokenService: this.tokenService,
          emailService: this.emailService,
          otpService: this.otpService,
          auditRepository: this.auditRepository,
          notificationService: this.notificationService,
          cacheService: this.cacheService,
        }),
    );
  }

  get userService() {
    return this.get(
      'userService',
      () =>
        new UserService({
          userRepository: this.userRepository,
          roleRepository: this.roleRepository,
          auditRepository: this.auditRepository,
          cacheService: this.cacheService,
          tokenService: this.tokenService,
        }),
    );
  }

  get roleService() {
    return this.get(
      'roleService',
      () =>
        new RoleService({
          roleRepository: this.roleRepository,
          permissionRepository: this.permissionRepository,
          auditRepository: this.auditRepository,
          cacheService: this.cacheService,
        }),
    );
  }

  get permissionService() {
    return this.get(
      'permissionService',
      () =>
        new PermissionService({
          permissionRepository: this.permissionRepository,
          auditRepository: this.auditRepository,
          cacheService: this.cacheService,
        }),
    );
  }

  get exportService() {
    return this.get(
      'exportService',
      () => new ExportService({ userRepository: this.userRepository }),
    );
  }

  get adminBootstrapService() {
    return this.get(
      'adminBootstrapService',
      () =>
        new AdminBootstrapService({
          userRepository: this.userRepository,
          roleRepository: this.roleRepository,
          permissionRepository: this.permissionRepository,
          auditRepository: this.auditRepository,
        }),
    );
  }

  get investorService() {
    return this.get(
      'investorService',
      () =>
        new InvestorService(
          this.investorRepository,
          this.userRepository,
          this.roleRepository,
          this.investmentRepository,
          this.paymentRepository,
          this.loanRepository,
          this.timelineRepository,
          this.auditRepository,
        ),
    );
  }

  get investmentService() {
    return this.get(
      'investmentService',
      () =>
        new InvestmentService(
          this.investmentRepository,
          this.investorRepository,
          this.paymentRepository,
          this.loanRepository,
          this.timelineRepository,
          this.investorService,
          this.auditRepository,
        ),
    );
  }

  get documentService() {
    return this.get(
      'documentService',
      () =>
        new DocumentService(this.reportRepository, this.contractRepository, this.auditRepository),
    );
  }

  get dashboardService() {
    return this.get(
      'dashboardService',
      () =>
        new DashboardService(
          this.investorRepository,
          this.investmentRepository,
          this.paymentRepository,
          this.investmentService,
        ),
    );
  }

  get domainExportService() {
    return this.get(
      'domainExportService',
      () =>
        new DomainExportService(
          this.investmentRepository,
          this.paymentRepository,
          this.investorRepository,
        ),
    );
  }

  reset() {
    this.#singletons.clear();
  }
}

export const container = new Container();
export default container;
