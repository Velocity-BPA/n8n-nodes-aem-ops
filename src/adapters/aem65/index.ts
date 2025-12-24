/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * AEM 6.5 Adapter Exports
 * All AEM 6.5 specific functionality
 */

// Types
export * from './types';

// Health Check
export {
  performHealthCheck,
  performReadinessCheck,
  performMultiEndpointHealthCheck,
  buildHealthCheckUrl,
} from './healthCheck';

// Replication
export {
  performReplication,
  activatePaths,
  deactivatePaths,
  getReplicationQueueStatus,
} from './replication';

// Package Manager
export {
  uploadPackage,
  uploadAndInstallPackage,
  listPackages,
  buildPackage,
  deletePackage,
} from './packageManager';
