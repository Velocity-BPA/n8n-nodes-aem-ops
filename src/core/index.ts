/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Core Module Exports
 * Shared utilities for n8n-nodes-aem-ops
 */

// Types
export * from './types';

// HTTP Client
export { AemHttpClient, createHttpClient, createHttpClientWithCredentials } from './httpClient';
export type { HttpClientConfig, RequestOptions } from './httpClient';

// Retry utilities
export {
  withRetry,
  createRetryWrapper,
  shouldRetry,
  calculateBackoffDelay,
  parseRetryAfterHeader,
  isRetryableStatusCode,
  isRetryableErrorCode,
  sleep,
  DEFAULT_RETRY_CONFIG,
} from './retry';
export type { RetryConfig, RetryDecision } from './retry';

// Validation utilities
export {
  validateAemPath,
  validateAemPaths,
  validateUrl,
  validateUrlAgainstAllowlist,
  validateUrlsAgainstAllowlist,
  validateAemBaseUrl,
  normalizeBaseUrl,
  sanitizePath,
  parsePathList,
} from './validation';
export type { ValidationResult } from './validation';

// Redaction utilities
export {
  redactHeaders,
  redactObject,
  redactUrl,
  redactErrorMessage,
  createLogSafeOptions,
} from './redaction';

// Licensing
export { logLicenseNotice } from './licensing';
