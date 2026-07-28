export const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFY: 'email_verify',
  OTP: 'otp',
  API_KEY: 'api_key',
});

export const TOKEN_TYPE_LIST = Object.freeze(Object.values(TOKEN_TYPES));

export default TOKEN_TYPES;
