/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * n8n-nodes-aem-ops
 * n8n community nodes for Adobe Experience Manager operations
 */

import { logLicenseNotice } from './core/licensing';

// Log licensing notice once on module load (non-blocking, informational only)
logLicenseNotice();

// Credentials
export { Aem65Credentials } from './credentials/Aem65Credentials.credentials';
export { AemCloudCredentials } from './credentials/AemCloudCredentials.credentials';

// Nodes
export { AemHealthCheck } from './nodes/AemHealthCheck/AemHealthCheck.node';
export { AemReplicate } from './nodes/AemReplicate/AemReplicate.node';
export { AemPackage } from './nodes/AemPackage/AemPackage.node';
export { AemCachePurge } from './nodes/AemCachePurge/AemCachePurge.node';
