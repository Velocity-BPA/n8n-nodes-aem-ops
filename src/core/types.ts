/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Core Types for n8n-nodes-aem-ops
 * Shared type definitions for consistent output schemas across all nodes
 */

// =============================================================================
// Base Types
// =============================================================================

/**
 * Standard timestamp format used across all outputs
 */
export type ISOTimestamp = string;

/**
 * HTTP status codes
 */
export type HttpStatusCode = number;

/**
 * Base output that all node results extend
 */
export interface BaseOutput {
  /** Operation success indicator */
  ok: boolean;
  /** HTTP status code from the operation */
  statusCode: HttpStatusCode;
  /** ISO 8601 timestamp of when the operation completed */
  timestamp: ISOTimestamp;
}

// =============================================================================
// Health Check Types
// =============================================================================

/**
 * Output schema for AEM Health Check node
 */
export interface HealthCheckOutput extends BaseOutput {
  /** Response latency in milliseconds */
  latencyMs: number;
  /** The URL that was checked */
  checkedUrl: string;
  /** Additional notes about the health check */
  notes: string[];
}

/**
 * Health check configuration options
 */
export interface HealthCheckOptions {
  /** Custom health endpoint path (defaults to /system/health) */
  healthEndpoint?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

// =============================================================================
// Replication Types
// =============================================================================

/**
 * Replication action types
 */
export type ReplicationAction = 'activate' | 'deactivate';

/**
 * Output schema for a single path replication result
 */
export interface ReplicationPathResult extends BaseOutput {
  /** The content path that was replicated */
  path: string;
  /** The action performed */
  action: ReplicationAction;
  /** Whether the replication was requested (vs dry-run) */
  requested: boolean;
  /** Human-readable message about the result */
  message: string;
  /** Duration of this specific replication in milliseconds */
  durationMs: number;
}

/**
 * Output schema for AEM Replicate node (contains all path results)
 */
export interface ReplicationOutput {
  /** Overall success - true only if all paths succeeded */
  ok: boolean;
  /** Total number of paths processed */
  totalPaths: number;
  /** Number of successful replications */
  successCount: number;
  /** Number of failed replications */
  failureCount: number;
  /** Whether this was a dry run */
  dryRun: boolean;
  /** Individual results per path */
  results: ReplicationPathResult[];
  /** ISO 8601 timestamp of operation completion */
  timestamp: ISOTimestamp;
}

/**
 * Replication request options
 */
export interface ReplicationOptions {
  /** Paths to replicate */
  paths: string[];
  /** Action to perform */
  action: ReplicationAction;
  /** Number of paths to process in each batch */
  batchSize?: number;
  /** Delay between batches in milliseconds */
  throttleMs?: number;
  /** If true, don't actually replicate */
  dryRun?: boolean;
}

// =============================================================================
// Package Manager Types
// =============================================================================

/**
 * Output schema for AEM Package Upload & Install node
 */
export interface PackageOutput extends BaseOutput {
  /** Whether the package was uploaded */
  uploaded: boolean;
  /** Whether the package was installed */
  installed: boolean;
  /** Package ID in AEM (group:name:version) */
  packageId: string | null;
  /** Package name */
  packageName: string;
  /** Operation logs from AEM */
  logs: string[];
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Package upload options
 */
export interface PackageUploadOptions {
  /** Package binary data */
  packageData: Buffer;
  /** Optional package name override */
  packageName?: string;
  /** Whether to install after upload */
  install?: boolean;
  /** If true, don't actually upload */
  dryRun?: boolean;
}

// =============================================================================
// Cache Purge Types
// =============================================================================

/**
 * HTTP methods supported for cache purge
 */
export type PurgeMethod = 'PURGE' | 'POST';

/**
 * Output schema for a single URL purge result
 */
export interface PurgeUrlResult extends BaseOutput {
  /** The URL that was purged */
  url: string;
  /** HTTP method used */
  method: PurgeMethod;
  /** Whether the purge was actually sent (vs dry-run) */
  requested: boolean;
  /** Response message */
  message: string;
}

/**
 * Output schema for AEM Cache Purge node
 */
export interface CachePurgeOutput {
  /** Overall success - true only if all URLs succeeded */
  ok: boolean;
  /** Total number of URLs processed */
  totalUrls: number;
  /** Number of successful purges */
  successCount: number;
  /** Number of failed purges */
  failureCount: number;
  /** Whether this was a dry run */
  dryRun: boolean;
  /** Individual results per URL */
  results: PurgeUrlResult[];
  /** ISO 8601 timestamp of operation completion */
  timestamp: ISOTimestamp;
}

/**
 * Cache purge options
 */
export interface CachePurgeOptions {
  /** URLs to purge */
  purgeUrls: string[];
  /** HTTP method to use */
  method: PurgeMethod;
  /** Regex pattern for URL allowlist validation */
  allowlistRegex: string;
  /** Additional headers to send */
  headers?: Record<string, string>;
  /** If true, don't actually purge */
  dryRun?: boolean;
}

// =============================================================================
// Credential Types
// =============================================================================

/**
 * Authentication method selector
 */
export type AuthMethod = 'basic' | 'bearer';

/**
 * AEM 6.5 credentials structure
 */
export interface Aem65Credentials {
  /** Base URL of AEM Author instance */
  baseUrl: string;
  /** Authentication method */
  authMethod: AuthMethod;
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
  /** Bearer token */
  bearerToken?: string;
  /** Allow insecure TLS (development only) */
  insecureTls?: boolean;
  /** Enable CSRF token handling */
  csrfEnabled?: boolean;
}

/**
 * AEM Cloud credentials structure (stub)
 */
export interface AemCloudCredentials {
  /** Organization ID */
  organizationId: string;
  /** Program ID */
  programId: string;
  /** Environment ID */
  environmentId: string;
  /** IMS Client ID */
  clientId: string;
  /** IMS Client Secret */
  clientSecret: string;
  /** IMS Org ID */
  imsOrgId: string;
}

// =============================================================================
// HTTP Client Types
// =============================================================================

/**
 * HTTP request options for the internal client
 */
export interface HttpRequestOptions {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PURGE';
  /** Request URL */
  url: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Form data */
  formData?: Record<string, unknown>;
  /** Query parameters */
  qs?: Record<string, string | number | boolean>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Skip TLS verification (development only) */
  skipTlsVerify?: boolean;
  /** Return full response object */
  returnFullResponse?: boolean;
}

/**
 * HTTP response from the internal client
 */
export interface HttpResponse<T = unknown> {
  /** Response status code */
  statusCode: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body: T;
  /** Request latency in milliseconds */
  latencyMs: number;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * AEM-specific error codes
 */
export enum AemErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'AEM_CONNECTION_FAILED',
  TIMEOUT = 'AEM_TIMEOUT',
  TLS_ERROR = 'AEM_TLS_ERROR',

  // Authentication errors
  AUTHENTICATION_FAILED = 'AEM_AUTH_FAILED',
  CSRF_TOKEN_FAILED = 'AEM_CSRF_FAILED',
  FORBIDDEN = 'AEM_FORBIDDEN',

  // Operation errors
  REPLICATION_FAILED = 'AEM_REPLICATION_FAILED',
  PACKAGE_UPLOAD_FAILED = 'AEM_PACKAGE_UPLOAD_FAILED',
  PACKAGE_INSTALL_FAILED = 'AEM_PACKAGE_INSTALL_FAILED',
  HEALTH_CHECK_FAILED = 'AEM_HEALTH_CHECK_FAILED',
  PURGE_FAILED = 'AEM_PURGE_FAILED',

  // Validation errors
  INVALID_PATH = 'AEM_INVALID_PATH',
  INVALID_URL = 'AEM_INVALID_URL',
  ALLOWLIST_VIOLATION = 'AEM_ALLOWLIST_VIOLATION',

  // Not implemented
  NOT_IMPLEMENTED = 'AEM_NOT_IMPLEMENTED',
}

/**
 * Structured error details for AEM operations
 */
export interface AemErrorDetails {
  /** Error code for programmatic handling */
  code: AemErrorCode;
  /** Human-readable error message */
  message: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** The URL that caused the error */
  url?: string;
  /** The path that caused the error */
  path?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}
