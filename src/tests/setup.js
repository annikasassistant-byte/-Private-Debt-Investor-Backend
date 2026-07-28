/**
 * Jest ESM setup — runs after the environment is ready.
 * Root `jest.setup.js` already sets env secrets; this file adds shared matchers/hooks.
 */
import { jest } from '@jest/globals';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

global.jest = jest;

afterEach(() => {
  jest.clearAllMocks();
});
