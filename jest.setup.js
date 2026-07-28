import { jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters!';
process.env.MONGODB_URI = 'mongodb://localhost:27017/depth_dashboard_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.COOKIE_SECRET = 'test-cookie-secret-min-32-characters!!';

global.jest = jest;
