/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * AEM 6.5 Adapter Types
 * Types specific to AEM 6.5 on-premise API responses and requests
 */

/**
 * AEM Health check response structure
 */
export interface Aem65HealthResponse {
  /** Overall health status */
  status?: string;
  /** Individual health check results */
  results?: Aem65HealthCheckResult[];
  /** Raw HTML response (some endpoints return HTML) */
  html?: string;
}

/**
 * Individual health check result
 */
export interface Aem65HealthCheckResult {
  /** Check name */
  name: string;
  /** Check status */
  status: 'OK' | 'WARN' | 'CRITICAL' | 'UNKNOWN';
  /** Status message */
  message?: string;
}

/**
 * AEM Replication agent response
 */
export interface Aem65ReplicationResponse {
  /** Response status path */
  path?: string;
  /** Response message */
  message?: string;
  /** Replication status */
  status?: {
    isBlocked?: boolean;
    isPaused?: boolean;
    time?: number;
  };
}

/**
 * AEM Replication queue item
 */
export interface Aem65ReplicationQueueItem {
  /** Item ID */
  id: string;
  /** Content path */
  path: string;
  /** Action type */
  action: string;
  /** Timestamp */
  time: number;
  /** User who triggered */
  user: string;
}

/**
 * Package Manager upload response
 */
export interface Aem65PackageUploadResponse {
  /** Whether operation was successful */
  success: boolean;
  /** Response message */
  msg: string;
  /** Package path in repository */
  path?: string;
}

/**
 * Package Manager install response
 */
export interface Aem65PackageInstallResponse {
  /** Whether operation was successful */
  success: boolean;
  /** Response message */
  msg: string;
  /** Installation log lines */
  log?: string[];
}

/**
 * Package info from Package Manager
 */
export interface Aem65PackageInfo {
  /** Package group */
  group: string;
  /** Package name */
  name: string;
  /** Package version */
  version: string;
  /** Download name (filename) */
  downloadName: string;
  /** Package size in bytes */
  size: number;
  /** Created timestamp */
  created: number;
  /** Created by user */
  createdBy: string;
  /** Last modified timestamp */
  lastModified: number;
  /** Last modified by user */
  lastModifiedBy: string;
  /** Last unpacked timestamp */
  lastUnpacked?: number;
  /** Last unpacked by user */
  lastUnpackedBy?: string;
}

/**
 * AEM 6.5 specific endpoints
 */
export const AEM65_ENDPOINTS = {
  /** Health check endpoints */
  health: {
    /** System health (requires proper permissions) */
    system: '/system/health',
    /** Ready check */
    ready: '/libs/granite/core/content/login.html',
    /** CRXDE status (dev) */
    crxde: '/crx/de/index.jsp',
  },

  /** Replication endpoints */
  replication: {
    /** Replication action servlet */
    action: '/bin/replicate.json',
    /** Tree replication */
    tree: '/bin/replicate.json',
    /** Agent base path */
    agentBase: '/etc/replication/agents.author',
  },

  /** Package Manager endpoints */
  packageManager: {
    /** Package list */
    list: '/crx/packmgr/list.jsp',
    /** Service endpoint */
    service: '/crx/packmgr/service.jsp',
    /** Package upload */
    upload: '/crx/packmgr/service/.json',
    /** Package install (append package path) */
    install: '/crx/packmgr/service/script.html',
  },

  /** CSRF token endpoint */
  csrf: '/libs/granite/csrf/token.json',
} as const;

/**
 * Replication action types in AEM 6.5
 */
export type Aem65ReplicationAction = 'activate' | 'deactivate' | 'delete' | 'test';

/**
 * Request payload for replication
 */
export interface Aem65ReplicationRequest {
  /** Action to perform */
  cmd: Aem65ReplicationAction;
  /** Path to replicate */
  path: string;
  /** Agent ID (optional) */
  agentId?: string;
}
