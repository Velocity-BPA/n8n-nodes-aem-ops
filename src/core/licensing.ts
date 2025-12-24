/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Licensing Notice Utility
 * Logs licensing information once per node load (non-blocking, informational only)
 */

let hasLoggedLicenseNotice = false;

/**
 * Log the licensing notice once per process lifetime.
 * This is informational only and does not block or degrade functionality.
 */
export function logLicenseNotice(): void {
  if (hasLoggedLicenseNotice) {
    return;
  }

  hasLoggedLicenseNotice = true;

  // Use console.warn for WARN-level logging
  // This is non-blocking and purely informational
  console.warn(`
[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.
`);
}
