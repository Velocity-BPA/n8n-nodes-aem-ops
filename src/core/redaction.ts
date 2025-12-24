/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Redaction Utility
 * Ensures sensitive data is never logged or exposed in error messages
 */

/**
 * List of header names that should always be redacted
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'x-api-key',
  'api-key',
  'apikey',
  'x-csrf-token',
  'csrf-token',
  'x-access-token',
  'access-token',
  'bearer',
  'x-bearer-token',
  'proxy-authorization',
  'www-authenticate',
];

/**
 * List of field names in objects that should be redacted
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'apiKey',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'bearer',
  'bearerToken',
  'bearer_token',
  'client_secret',
  'clientSecret',
  'private_key',
  'privateKey',
  'auth',
  'authentication',
  'credential',
  'credentials',
];

/**
 * Redaction placeholder
 */
const REDACTED = '[REDACTED]';

/**
 * Check if a key is sensitive and should be redacted
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return (
    SENSITIVE_HEADERS.includes(lowerKey) ||
    SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))
  );
}

/**
 * Redact sensitive values from headers
 *
 * @param headers - Object containing HTTP headers
 * @returns New object with sensitive headers redacted
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveKey(key)) {
      redacted[key] = REDACTED;
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Redact sensitive values from an object (deep redaction)
 *
 * @param obj - Object to redact
 * @param depth - Current recursion depth (max 10 to prevent stack overflow)
 * @returns New object with sensitive values redacted
 */
export function redactObject<T>(obj: T, depth = 0): T {
  // Prevent infinite recursion
  if (depth > 10) {
    return obj;
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1)) as T;
  }

  // Handle objects
  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        redacted[key] = REDACTED;
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactObject(value, depth + 1);
      } else {
        redacted[key] = value;
      }
    }

    return redacted as T;
  }

  // Return primitives as-is
  return obj;
}

/**
 * Redact sensitive values from a URL string
 * Handles query parameters that might contain sensitive data
 *
 * @param url - URL string to redact
 * @returns URL with sensitive query parameters redacted
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Check each query parameter
    for (const key of parsed.searchParams.keys()) {
      if (isSensitiveKey(key)) {
        parsed.searchParams.set(key, REDACTED);
      }
    }

    // Redact basic auth in URL if present
    if (parsed.password) {
      parsed.password = REDACTED;
    }
    if (parsed.username && parsed.password === REDACTED) {
      // Keep username visible if password was present
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, do basic string replacement
    return url
      .replace(/password=[^&]+/gi, `password=${REDACTED}`)
      .replace(/token=[^&]+/gi, `token=${REDACTED}`)
      .replace(/apikey=[^&]+/gi, `apikey=${REDACTED}`)
      .replace(/:[^:@]+@/g, `:${REDACTED}@`);
  }
}

/**
 * Create a safe error message by redacting sensitive data
 *
 * @param message - Error message that might contain sensitive data
 * @returns Redacted error message
 */
export function redactErrorMessage(message: string): string {
  let redacted = message;

  // Redact base64-encoded auth headers
  redacted = redacted.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, `Basic ${REDACTED}`);
  redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, `Bearer ${REDACTED}`);

  // Redact common patterns
  redacted = redacted.replace(/"password"\s*:\s*"[^"]+"/gi, `"password": "${REDACTED}"`);
  redacted = redacted.replace(/"token"\s*:\s*"[^"]+"/gi, `"token": "${REDACTED}"`);
  redacted = redacted.replace(/"secret"\s*:\s*"[^"]+"/gi, `"secret": "${REDACTED}"`);
  redacted = redacted.replace(/"apiKey"\s*:\s*"[^"]+"/gi, `"apiKey": "${REDACTED}"`);

  return redacted;
}

/**
 * Create a log-safe version of request options
 *
 * @param options - HTTP request options
 * @returns Options safe for logging
 */
export function createLogSafeOptions(
  options: Record<string, unknown>,
): Record<string, unknown> {
  const safe = redactObject(options);

  // Ensure headers are redacted
  if (safe.headers && typeof safe.headers === 'object') {
    safe.headers = redactHeaders(safe.headers as Record<string, string>);
  }

  // Redact URL
  if (typeof safe.url === 'string') {
    safe.url = redactUrl(safe.url);
  }

  return safe;
}
