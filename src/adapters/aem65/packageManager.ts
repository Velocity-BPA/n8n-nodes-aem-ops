/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * AEM 6.5 Package Manager Adapter
 * Handles CRX package upload and installation for AEM 6.5 on-premise
 */

import type { AemHttpClient } from '../../core/httpClient';
import type { PackageOutput, PackageUploadOptions } from '../../core/types';
import {
  AEM65_ENDPOINTS,
  type Aem65PackageUploadResponse,
  type Aem65PackageInstallResponse,
} from './types';

/**
 * Default package options
 */
const DEFAULT_OPTIONS: Required<Omit<PackageUploadOptions, 'packageData'>> = {
  packageName: '',
  install: false,
  dryRun: false,
};

/**
 * Extract package name from binary data or filename
 */
function extractPackageName(_data: Buffer, providedName?: string): string {
  if (providedName && providedName.trim()) {
    // Ensure .zip extension
    const name = providedName.trim();
    return name.endsWith('.zip') ? name : `${name}.zip`;
  }

  // Generate a default name with timestamp
  const timestamp = Date.now();
  return `package-${timestamp}.zip`;
}

/**
 * Parse package ID from AEM response
 */
function parsePackageId(response: Aem65PackageUploadResponse | string): string | null {
  if (typeof response === 'string') {
    // Try to parse JSON from string response
    try {
      const parsed = JSON.parse(response) as Aem65PackageUploadResponse;
      return parsed.path || null;
    } catch {
      // Check for path in HTML response
      const pathMatch = response.match(/\/etc\/packages\/[^"<\s]+\.zip/);
      return pathMatch ? pathMatch[0] : null;
    }
  }

  return response.path || null;
}

/**
 * Parse installation logs from response
 */
function parseInstallLogs(response: Aem65PackageInstallResponse | string): string[] {
  const logs: string[] = [];

  if (typeof response === 'string') {
    // Extract log lines from HTML response
    const lines = response.split('\n');
    for (const line of lines) {
      const trimmed = line.replace(/<[^>]*>/g, '').trim();
      if (trimmed && !trimmed.startsWith('<') && trimmed.length > 0) {
        logs.push(trimmed);
      }
    }
    return logs.slice(0, 100); // Limit log lines
  }

  if (response.log && Array.isArray(response.log)) {
    return response.log;
  }

  if (response.msg) {
    logs.push(response.msg);
  }

  return logs;
}

/**
 * Check if response indicates success
 */
function isSuccessResponse(
  response: Aem65PackageUploadResponse | Aem65PackageInstallResponse | string,
  statusCode: number,
): boolean {
  if (statusCode < 200 || statusCode >= 300) {
    return false;
  }

  if (typeof response === 'string') {
    // Check for success indicators in HTML
    return (
      response.includes('success') ||
      response.includes('Package uploaded') ||
      response.includes('Package installed') ||
      !response.includes('error') ||
      !response.includes('Error')
    );
  }

  return response.success === true;
}

/**
 * Upload a package to AEM Package Manager
 *
 * @param client - HTTP client instance
 * @param packageData - Package binary data (zip file)
 * @param options - Upload options
 * @returns Upload result
 */
export async function uploadPackage(
  client: AemHttpClient,
  packageData: Buffer,
  options: Partial<Omit<PackageUploadOptions, 'packageData'>> = {},
): Promise<PackageOutput> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const timestamp = new Date().toISOString();
  const packageName = extractPackageName(packageData, opts.packageName);
  const logs: string[] = [];

  // Dry run handling
  if (opts.dryRun) {
    logs.push('[DRY RUN] Would upload package');
    if (opts.install) {
      logs.push('[DRY RUN] Would install package after upload');
    }

    return {
      ok: true,
      statusCode: 200,
      uploaded: false,
      installed: false,
      packageId: null,
      packageName,
      logs,
      dryRun: true,
      timestamp,
    };
  }

  let uploaded = false;
  let installed = false;
  let packageId: string | null = null;
  let statusCode = 0;

  try {
    // Upload the package
    logs.push(`Uploading package: ${packageName}`);

    const uploadResponse = await client.uploadFile<Aem65PackageUploadResponse | string>(
      `${AEM65_ENDPOINTS.packageManager.service}?cmd=upload&force=true`,
      packageData,
      packageName,
    );

    statusCode = uploadResponse.statusCode;
    uploaded = isSuccessResponse(uploadResponse.body, statusCode);
    packageId = parsePackageId(uploadResponse.body);

    if (uploaded) {
      logs.push(`Package uploaded successfully`);
      if (packageId) {
        logs.push(`Package path: ${packageId}`);
      }
    } else {
      logs.push(`Package upload failed`);
      const uploadLogs = parseInstallLogs(uploadResponse.body as string);
      logs.push(...uploadLogs);

      return {
        ok: false,
        statusCode,
        uploaded: false,
        installed: false,
        packageId,
        packageName,
        logs,
        dryRun: false,
        timestamp,
      };
    }

    // Install if requested
    if (opts.install && packageId) {
      logs.push(`Installing package...`);

      const installResponse = await client.postForm<Aem65PackageInstallResponse | string>(
        `${AEM65_ENDPOINTS.packageManager.service}/script.html${packageId}`,
        {
          cmd: 'install',
        },
      );

      statusCode = installResponse.statusCode;
      installed = isSuccessResponse(installResponse.body, statusCode);

      const installLogs = parseInstallLogs(installResponse.body);
      logs.push(...installLogs);

      if (installed) {
        logs.push(`Package installed successfully`);
      } else {
        logs.push(`Package installation failed`);
      }
    }

    return {
      ok: uploaded && (opts.install ? installed : true),
      statusCode,
      uploaded,
      installed,
      packageId,
      packageName,
      logs,
      dryRun: false,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logs.push(`Error: ${errorMessage}`);

    return {
      ok: false,
      statusCode: (error as { httpCode?: string }).httpCode
        ? parseInt((error as { httpCode?: string }).httpCode as string, 10)
        : 500,
      uploaded,
      installed,
      packageId,
      packageName,
      logs,
      dryRun: false,
      timestamp,
    };
  }
}

/**
 * Upload and install a package in one operation
 *
 * @param client - HTTP client instance
 * @param packageData - Package binary data
 * @param options - Upload options
 * @returns Operation result
 */
export async function uploadAndInstallPackage(
  client: AemHttpClient,
  packageData: Buffer,
  options: Partial<Omit<PackageUploadOptions, 'packageData' | 'install'>> = {},
): Promise<PackageOutput> {
  return uploadPackage(client, packageData, { ...options, install: true });
}

/**
 * List packages in Package Manager
 */
export async function listPackages(
  client: AemHttpClient,
  group?: string,
): Promise<{
  ok: boolean;
  packages: Array<{
    group: string;
    name: string;
    version: string;
    path: string;
  }>;
}> {
  try {
    const url = group
      ? `${AEM65_ENDPOINTS.packageManager.list}?group=${encodeURIComponent(group)}`
      : AEM65_ENDPOINTS.packageManager.list;

    const response = await client.get<{
      results?: Array<{
        group: string;
        name: string;
        version: string;
        downloadName: string;
      }>;
    }>(url);

    const packages = (response.body.results || []).map((pkg) => ({
      group: pkg.group,
      name: pkg.name,
      version: pkg.version,
      path: `/etc/packages/${pkg.group}/${pkg.downloadName}`,
    }));

    return { ok: true, packages };
  } catch {
    return { ok: false, packages: [] };
  }
}

/**
 * Build a package (create package from definition)
 */
export async function buildPackage(
  client: AemHttpClient,
  packagePath: string,
): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const response = await client.postForm<{ success: boolean; msg: string }>(
      `${AEM65_ENDPOINTS.packageManager.service}/script.html${packagePath}`,
      { cmd: 'build' },
    );

    return {
      ok: response.body.success,
      message: response.body.msg,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Build failed',
    };
  }
}

/**
 * Delete a package from Package Manager
 */
export async function deletePackage(
  client: AemHttpClient,
  packagePath: string,
): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const response = await client.postForm<{ success: boolean; msg: string }>(
      `${AEM65_ENDPOINTS.packageManager.service}/script.html${packagePath}`,
      { cmd: 'delete' },
    );

    return {
      ok: response.body.success,
      message: response.body.msg,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}
