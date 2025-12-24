/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Validation Utilities
 * Input validation for URLs, paths, and allowlist matching
 */

import { AemErrorCode, type AemErrorDetails } from './types';

/**
 * Result of a validation check
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error details if validation failed */
  error?: AemErrorDetails;
}

/**
 * Validate an AEM content path
 * Valid paths must:
 * - Start with /
 * - Not contain .. (path traversal)
 * - Not contain special characters that could be exploited
 *
 * @param path - The path to validate
 * @returns Validation result
 */
export function validateAemPath(path: string): ValidationResult {
  // Must be a non-empty string
  if (!path || typeof path !== 'string') {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_PATH,
        message: 'Path must be a non-empty string',
        path,
      },
    };
  }

  // Must start with /
  if (!path.startsWith('/')) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_PATH,
        message: 'Path must start with /',
        path,
      },
    };
  }

  // No path traversal
  if (path.includes('..')) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_PATH,
        message: 'Path must not contain path traversal sequences (..)',
        path,
      },
    };
  }

  // No null bytes or control characters
  if (/[\x00-\x1f\x7f]/.test(path)) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_PATH,
        message: 'Path must not contain control characters',
        path,
      },
    };
  }

  // Check for common AEM path patterns
  const validPathPatterns = [
    /^\/content\//,
    /^\/apps\//,
    /^\/etc\//,
    /^\/conf\//,
    /^\/libs\//,
    /^\/var\//,
    /^\/home\//,
    /^\/tmp\//,
    /^\/oak:/,
  ];

  // Warn but don't fail for unusual paths
  const isCommonPath = validPathPatterns.some((pattern) => pattern.test(path));
  if (!isCommonPath) {
    // Still valid, but uncommon
  }

  return { valid: true };
}

/**
 * Validate multiple AEM paths
 *
 * @param paths - Array of paths to validate
 * @returns Validation result (fails if any path is invalid)
 */
export function validateAemPaths(paths: string[]): ValidationResult {
  if (!Array.isArray(paths)) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_PATH,
        message: 'Paths must be an array',
      },
    };
  }

  if (paths.length === 0) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_PATH,
        message: 'At least one path is required',
      },
    };
  }

  for (const path of paths) {
    const result = validateAemPath(path);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Validate a URL
 *
 * @param url - The URL to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateUrl(
  url: string,
  options?: {
    requireHttps?: boolean;
    allowLocalhost?: boolean;
  },
): ValidationResult {
  const { requireHttps = false, allowLocalhost = true } = options || {};

  // Must be a non-empty string
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: 'URL must be a non-empty string',
        url,
      },
    };
  }

  // Try to parse the URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: 'Invalid URL format',
        url,
      },
    };
  }

  // Check protocol
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: 'URL must use HTTP or HTTPS protocol',
        url,
      },
    };
  }

  // Check HTTPS requirement
  if (requireHttps && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: 'URL must use HTTPS',
        url,
      },
    };
  }

  // Check localhost restriction
  const isLocalhost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1' ||
    parsed.hostname.endsWith('.localhost');

  if (isLocalhost && !allowLocalhost) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: 'Localhost URLs are not allowed',
        url,
      },
    };
  }

  return { valid: true };
}

/**
 * Validate a URL against an allowlist regex pattern
 *
 * @param url - The URL to validate
 * @param allowlistPattern - Regex pattern string for allowed URLs
 * @returns Validation result
 */
export function validateUrlAgainstAllowlist(
  url: string,
  allowlistPattern: string,
): ValidationResult {
  // First validate the URL format
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    return urlValidation;
  }

  // Empty allowlist pattern means all URLs are allowed
  if (!allowlistPattern || allowlistPattern.trim() === '') {
    return { valid: true };
  }

  // Compile and test the regex
  let regex: RegExp;
  try {
    regex = new RegExp(allowlistPattern);
  } catch (e) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: `Invalid allowlist regex pattern: ${allowlistPattern}`,
        context: { pattern: allowlistPattern },
      },
    };
  }

  // Test the URL against the pattern
  if (!regex.test(url)) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.ALLOWLIST_VIOLATION,
        message: `URL does not match allowlist pattern: ${allowlistPattern}`,
        url,
        context: { pattern: allowlistPattern },
      },
    };
  }

  return { valid: true };
}

/**
 * Validate multiple URLs against an allowlist
 *
 * @param urls - Array of URLs to validate
 * @param allowlistPattern - Regex pattern string for allowed URLs
 * @returns Validation result (fails if any URL is invalid)
 */
export function validateUrlsAgainstAllowlist(
  urls: string[],
  allowlistPattern: string,
): ValidationResult {
  if (!Array.isArray(urls)) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: 'URLs must be an array',
      },
    };
  }

  if (urls.length === 0) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: 'At least one URL is required',
      },
    };
  }

  for (const url of urls) {
    const result = validateUrlAgainstAllowlist(url, allowlistPattern);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Validate an AEM base URL (for credentials)
 *
 * @param baseUrl - The base URL to validate
 * @returns Validation result
 */
export function validateAemBaseUrl(baseUrl: string): ValidationResult {
  const result = validateUrl(baseUrl);
  if (!result.valid) {
    return result;
  }

  // Parse to check for path
  const parsed = new URL(baseUrl);

  // Warn if base URL has a path other than /
  if (parsed.pathname && parsed.pathname !== '/') {
    // This is valid but might indicate user error
  }

  // No query string or hash in base URL
  if (parsed.search || parsed.hash) {
    return {
      valid: false,
      error: {
        code: AemErrorCode.INVALID_URL,
        message: 'Base URL should not contain query parameters or hash',
        url: baseUrl,
      },
    };
  }

  return { valid: true };
}

/**
 * Normalize a base URL (remove trailing slash)
 *
 * @param baseUrl - The base URL to normalize
 * @returns Normalized URL
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Sanitize a path for use in URLs
 *
 * @param path - The path to sanitize
 * @returns Sanitized path
 */
export function sanitizePath(path: string): string {
  // Ensure leading slash
  let sanitized = path.startsWith('/') ? path : `/${path}`;

  // Remove double slashes
  sanitized = sanitized.replace(/\/+/g, '/');

  // Remove trailing slash (except for root)
  if (sanitized.length > 1) {
    sanitized = sanitized.replace(/\/+$/, '');
  }

  return sanitized;
}

/**
 * Parse a multiline string into an array of paths
 * Handles various separators (newlines, commas, semicolons)
 *
 * @param input - The input string to parse
 * @returns Array of trimmed, non-empty paths
 */
export function parsePathList(input: string): string[] {
  if (!input || typeof input !== 'string') {
    return [];
  }

  // Split by newlines, commas, or semicolons
  const paths = input
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return paths;
}
