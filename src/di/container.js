import {
  UserRepository,
  RoleRepository,
  PermissionRepository,
  RefreshTokenRepository,
  AuditRepository,
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
} from '../services/index.js';

/**
 * Simple DI container wiring repositories → services.
 */
export class Container {
  constructor() {
    /** @type {Map<string, any>} */
    this.#singletons = new Map();
  }

  #singletons;

  /**
   * @template T
   * @param {string} name
   * @param {() => T} factory
   * @returns {T}
   */
  get(name, factory) {
    if (!this.#singletons.has(name)) {
      this.#singletons.set(name, factory());
    }
    return this.#singletons.get(name);
  }

  // ---- Repositories ----

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

  // ---- Infrastructure services ----

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

  // ---- Domain services ----

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

  /** Reset singletons (tests). */
  reset() {
    this.#singletons.clear();
  }
}

/** Shared application container. */
export const container = new Container();

export default container;
