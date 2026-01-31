/**
 * Security Utilities for Fintra
 *
 * Provides functions for sanitizing sensitive data before logging.
 * Prevents accidental exposure of API keys, tokens, and credentials.
 */

/**
 * Masks sensitive values in URLs (API keys, tokens)
 *
 * @example
 * maskSensitiveUrl('https://api.com?apikey=secret123&data=foo')
 * // Returns: 'https://api.com?apikey=***&data=foo'
 */
export function maskSensitiveUrl(url: string): string {
  if (!url) return url;

  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    // List of sensitive parameter names
    const sensitiveParams = [
      'apikey',
      'api_key',
      'token',
      'access_token',
      'secret',
      'password',
      'auth',
      'authorization'
    ];

    sensitiveParams.forEach(param => {
      if (params.has(param)) {
        params.set(param, '***');
      }
    });

    urlObj.search = params.toString();
    return urlObj.toString();
  } catch (e) {
    // If URL parsing fails, do basic string replacement
    return url.replace(/([?&])(apikey|api_key|token|access_token|secret|password|auth|authorization)=([^&]+)/gi, '$1$2=***');
  }
}

/**
 * Masks API key showing only first and last 4 characters
 *
 * @example
 * maskApiKey('sk_live_1234567890abcdef')
 * // Returns: 'sk_l***cdef'
 */
export function maskApiKey(key: string | undefined | null): string {
  if (!key) return '***';
  if (key.length <= 8) return '***';

  return `${key.slice(0, 4)}***${key.slice(-4)}`;
}

/**
 * Sanitizes an object for logging by masking sensitive fields
 *
 * @example
 * sanitizeForLogging({ apiKey: 'secret123', data: 'public' })
 * // Returns: { apiKey: '***', data: 'public' }
 */
export function sanitizeForLogging(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'apikey',
    'api_key',
    'apiKey',
    'token',
    'access_token',
    'accessToken',
    'secret',
    'password',
    'auth',
    'authorization',
    'bearer'
  ];

  const sanitized = { ...obj };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Creates a safe logger that automatically masks sensitive data
 */
export const safeLog = {
  info: (message: string, data?: any) => {
    console.log(message, data ? sanitizeForLogging(data) : '');
  },
  error: (message: string, error?: any) => {
    console.error(message, error ? sanitizeForLogging(error) : '');
  },
  warn: (message: string, data?: any) => {
    console.warn(message, data ? sanitizeForLogging(data) : '');
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(message, data ? sanitizeForLogging(data) : '');
    }
  }
};
