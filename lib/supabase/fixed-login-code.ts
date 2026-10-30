/**
 * Test-only phone login: the code screen accepts the fixed code and no SMS is
 * sent. Also needs the backend's LOGIN_FIXED_OTP_ENABLED flag on, otherwise
 * the fixed code is rejected. Off unless EXPO_PUBLIC_FIXED_LOGIN_CODE=true.
 */
export const FIXED_LOGIN_CODE = "123456";
export const FIXED_LOGIN_CODE_ENABLED = process.env.EXPO_PUBLIC_FIXED_LOGIN_CODE === "true";
