/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Retry and Backoff Utilities
 * Handles retries with exponential backoff for transient errors
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (not including initial attempt) */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry */
  initialDelayMs: number;
  /** Maximum delay in milliseconds between retries */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Add random jitter to delays to prevent thundering herd */
  jitter: boolean;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: number[];
  /** Error codes that should trigger a retry */
  retryableErrorCodes: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableStatusCodes: [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ],
  retryableErrorCodes: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH',
  ],
};

/**
 * Result of checking if an error should be retried
 */
export interface RetryDecision {
  /** Whether to retry */
  shouldRetry: boolean;
  /** Delay before retry in milliseconds */
  delayMs: number;
  /** Reason for the decision */
  reason: string;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  // Calculate base delay with exponential backoff
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

  // Add jitter if enabled (±25% random variation)
  if (config.jitter) {
    const jitterRange = cappedDelay * 0.25;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    return Math.max(0, Math.floor(cappedDelay + jitter));
  }

  return Math.floor(cappedDelay);
}

/**
 * Parse Retry-After header value
 *
 * @param retryAfter - Value from Retry-After header
 * @returns Delay in milliseconds, or null if unable to parse
 */
export function parseRetryAfterHeader(retryAfter: string | undefined): number | null {
  if (!retryAfter) {
    return null;
  }

  // Try parsing as seconds (integer)
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  try {
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      const delayMs = date.getTime() - Date.now();
      return Math.max(0, delayMs);
    }
  } catch {
    // Failed to parse as date
  }

  return null;
}

/**
 * Check if an HTTP status code is retryable
 *
 * @param statusCode - HTTP status code
 * @param config - Retry configuration
 * @returns True if retryable
 */
export function isRetryableStatusCode(statusCode: number, config: RetryConfig): boolean {
  return config.retryableStatusCodes.includes(statusCode);
}

/**
 * Check if an error code is retryable
 *
 * @param errorCode - Error code (e.g., ECONNRESET)
 * @param config - Retry configuration
 * @returns True if retryable
 */
export function isRetryableErrorCode(errorCode: string, config: RetryConfig): boolean {
  return config.retryableErrorCodes.includes(errorCode);
}

/**
 * Decide whether to retry based on error information
 *
 * @param error - The error that occurred
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @param responseHeaders - Response headers (for Retry-After)
 * @returns Retry decision
 */
export function shouldRetry(
  error: {
    statusCode?: number;
    code?: string;
    message?: string;
  },
  attempt: number,
  config: RetryConfig,
  responseHeaders?: Record<string, string>,
): RetryDecision {
  // Check if we've exceeded max retries
  if (attempt >= config.maxRetries) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: `Maximum retries (${config.maxRetries}) exceeded`,
    };
  }

  // Check for retryable status code
  if (error.statusCode && isRetryableStatusCode(error.statusCode, config)) {
    // Check for Retry-After header (especially for 429)
    const retryAfterDelay = parseRetryAfterHeader(responseHeaders?.['retry-after']);
    const delay = retryAfterDelay ?? calculateBackoffDelay(attempt, config);

    return {
      shouldRetry: true,
      delayMs: delay,
      reason: `Retryable status code: ${error.statusCode}`,
    };
  }

  // Check for retryable error code
  if (error.code && isRetryableErrorCode(error.code, config)) {
    return {
      shouldRetry: true,
      delayMs: calculateBackoffDelay(attempt, config),
      reason: `Retryable error code: ${error.code}`,
    };
  }

  // Not retryable
  return {
    shouldRetry: false,
    delayMs: 0,
    reason: 'Error is not retryable',
  };
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration (optional, uses defaults)
 * @param onRetry - Optional callback called before each retry
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error, delayMs: number) => void,
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Extract error info
      const errorInfo = {
        statusCode: (error as { statusCode?: number }).statusCode,
        code: (error as { code?: string }).code,
        message: (error as Error).message,
      };

      // Check if we should retry
      const decision = shouldRetry(errorInfo, attempt, fullConfig);

      if (!decision.shouldRetry) {
        throw error;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error as Error, decision.delayMs);
      }

      // Wait before retrying
      await sleep(decision.delayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retry wrapper with preset configuration
 *
 * @param config - Retry configuration
 * @returns Function that wraps other functions with retry logic
 */
export function createRetryWrapper(config: Partial<RetryConfig> = {}) {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  return function retry<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error, delayMs: number) => void,
  ): Promise<T> {
    return withRetry(fn, fullConfig, onRetry);
  };
}
