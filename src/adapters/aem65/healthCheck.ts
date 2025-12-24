/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * AEM 6.5 Health Check Adapter
 * Handles health check API calls for AEM 6.5 on-premise
 */

import type { AemHttpClient } from '../../core/httpClient';
import type { HealthCheckOutput, HealthCheckOptions } from '../../core/types';
import { AEM65_ENDPOINTS, type Aem65HealthResponse } from './types';

/**
 * Default health check options
 */
const DEFAULT_OPTIONS: Required<HealthCheckOptions> = {
  healthEndpoint: AEM65_ENDPOINTS.health.system,
  timeoutMs: 10000,
};

/**
 * Parse health response and extract status
 */
function parseHealthResponse(
  response: Aem65HealthResponse | string,
  statusCode: number,
): { ok: boolean; notes: string[] } {
  const notes: string[] = [];

  // Handle string response (HTML login page, etc.)
  if (typeof response === 'string') {
    if (response.includes('login') || response.includes('Login')) {
      notes.push('AEM is responding but may require authentication');
      return { ok: statusCode >= 200 && statusCode < 400, notes };
    }
    if (response.includes('CRXDE') || response.includes('crxde')) {
      notes.push('CRXDE Lite is accessible');
      return { ok: true, notes };
    }
    notes.push('Received HTML response');
    return { ok: statusCode >= 200 && statusCode < 400, notes };
  }

  // Handle JSON health response
  if (response.status) {
    notes.push(`System status: ${response.status}`);
    const ok = response.status.toLowerCase() === 'ok' || response.status.toLowerCase() === 'green';
    return { ok, notes };
  }

  // Handle individual check results
  if (response.results && Array.isArray(response.results)) {
    let allOk = true;
    for (const result of response.results) {
      notes.push(`${result.name}: ${result.status}${result.message ? ` - ${result.message}` : ''}`);
      if (result.status !== 'OK') {
        allOk = false;
      }
    }
    return { ok: allOk, notes };
  }

  // Default: consider successful if status code is OK
  return { ok: statusCode >= 200 && statusCode < 400, notes };
}

/**
 * Build the health check URL
 */
export function buildHealthCheckUrl(
  baseUrl: string,
  options: HealthCheckOptions = {},
): string {
  const endpoint = options.healthEndpoint || DEFAULT_OPTIONS.healthEndpoint;

  // If endpoint is a full URL, use it directly
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  // Otherwise, append to base URL
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
}

/**
 * Perform a health check against AEM 6.5
 *
 * @param client - HTTP client instance
 * @param options - Health check options
 * @returns Health check result
 */
export async function performHealthCheck(
  client: AemHttpClient,
  options: HealthCheckOptions = {},
): Promise<HealthCheckOutput> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const timestamp = new Date().toISOString();

  const endpoint = opts.healthEndpoint;

  try {
    const response = await client.get<Aem65HealthResponse | string>(endpoint, {
      timeout: opts.timeoutMs,
      returnFullResponse: true,
    });

    const { ok, notes } = parseHealthResponse(response.body, response.statusCode);

    return {
      ok,
      statusCode: response.statusCode,
      latencyMs: response.latencyMs,
      checkedUrl: buildHealthCheckUrl('', { healthEndpoint: endpoint }),
      timestamp,
      notes,
    };
  } catch (error) {
    // Handle connection errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = (error as { httpCode?: string }).httpCode
      ? parseInt((error as { httpCode?: string }).httpCode as string, 10)
      : 0;

    return {
      ok: false,
      statusCode: statusCode || 0,
      latencyMs: 0,
      checkedUrl: buildHealthCheckUrl('', { healthEndpoint: endpoint }),
      timestamp,
      notes: [`Health check failed: ${errorMessage}`],
    };
  }
}

/**
 * Perform a quick readiness check (lightweight)
 * Uses the login page endpoint which doesn't require auth
 *
 * @param client - HTTP client instance
 * @returns Health check result
 */
export async function performReadinessCheck(
  client: AemHttpClient,
): Promise<HealthCheckOutput> {
  return performHealthCheck(client, {
    healthEndpoint: AEM65_ENDPOINTS.health.ready,
    timeoutMs: 5000,
  });
}

/**
 * Check multiple health endpoints and aggregate results
 *
 * @param client - HTTP client instance
 * @param endpoints - Array of endpoints to check
 * @returns Aggregated health check result
 */
export async function performMultiEndpointHealthCheck(
  client: AemHttpClient,
  endpoints: string[],
): Promise<HealthCheckOutput> {
  const timestamp = new Date().toISOString();
  const results: HealthCheckOutput[] = [];
  let totalLatency = 0;

  for (const endpoint of endpoints) {
    const result = await performHealthCheck(client, { healthEndpoint: endpoint });
    results.push(result);
    totalLatency += result.latencyMs;
  }

  // Aggregate results
  const allOk = results.every((r) => r.ok);
  const notes: string[] = [];

  for (let i = 0; i < endpoints.length; i++) {
    const result = results[i];
    notes.push(`[${endpoints[i]}] ${result.ok ? 'OK' : 'FAIL'} (${result.latencyMs}ms)`);
    if (result.notes.length > 0) {
      notes.push(...result.notes.map((n) => `  - ${n}`));
    }
  }

  return {
    ok: allOk,
    statusCode: allOk ? 200 : results.find((r) => !r.ok)?.statusCode || 500,
    latencyMs: totalLatency,
    checkedUrl: endpoints.join(', '),
    timestamp,
    notes,
  };
}
