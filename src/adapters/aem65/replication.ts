/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * AEM 6.5 Replication Adapter
 * Handles content replication (activation/deactivation) for AEM 6.5 on-premise
 */

import type { AemHttpClient } from '../../core/httpClient';
import type {
  ReplicationOutput,
  ReplicationPathResult,
  ReplicationOptions,
  ReplicationAction,
} from '../../core/types';
import { sleep } from '../../core/retry';
import { validateAemPath } from '../../core/validation';
import { AEM65_ENDPOINTS, type Aem65ReplicationResponse } from './types';

/**
 * Default replication options
 */
const DEFAULT_OPTIONS: Required<Omit<ReplicationOptions, 'paths' | 'action'>> = {
  batchSize: 10,
  throttleMs: 100,
  dryRun: false,
};

/**
 * Map our action type to AEM's cmd parameter
 */
function mapActionToCmd(action: ReplicationAction): string {
  switch (action) {
    case 'activate':
      return 'Activate';
    case 'deactivate':
      return 'Deactivate';
    default:
      return 'Activate';
  }
}

/**
 * Replicate a single path
 */
async function replicateSinglePath(
  client: AemHttpClient,
  path: string,
  action: ReplicationAction,
  dryRun: boolean,
): Promise<ReplicationPathResult> {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  // Validate the path
  const validation = validateAemPath(path);
  if (!validation.valid) {
    return {
      path,
      action,
      requested: false,
      ok: false,
      statusCode: 400,
      message: validation.error?.message || 'Invalid path',
      durationMs: Date.now() - startTime,
      timestamp,
    };
  }

  // If dry run, return simulated success
  if (dryRun) {
    return {
      path,
      action,
      requested: false,
      ok: true,
      statusCode: 200,
      message: `[DRY RUN] Would ${action} path`,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  }

  try {
    const response = await client.postForm<Aem65ReplicationResponse>(
      AEM65_ENDPOINTS.replication.action,
      {
        cmd: mapActionToCmd(action),
        path: path,
        _charset_: 'utf-8',
      },
    );

    const ok = response.statusCode >= 200 && response.statusCode < 300;
    const message = response.body?.message || (ok ? `Successfully ${action}d` : 'Replication failed');

    return {
      path,
      action,
      requested: true,
      ok,
      statusCode: response.statusCode,
      message,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = (error as { httpCode?: string }).httpCode
      ? parseInt((error as { httpCode?: string }).httpCode as string, 10)
      : 500;

    return {
      path,
      action,
      requested: true,
      ok: false,
      statusCode,
      message: `Replication failed: ${errorMessage}`,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  }
}

/**
 * Process paths in batches with throttling
 */
async function processBatches(
  client: AemHttpClient,
  paths: string[],
  action: ReplicationAction,
  batchSize: number,
  throttleMs: number,
  dryRun: boolean,
  processedPaths: Set<string>,
): Promise<ReplicationPathResult[]> {
  const results: ReplicationPathResult[] = [];
  const batches: string[][] = [];

  // Split into batches
  for (let i = 0; i < paths.length; i += batchSize) {
    batches.push(paths.slice(i, i + batchSize));
  }

  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    // Process paths in batch (could be parallelized, but sequential is safer)
    for (const path of batch) {
      // Skip if already processed (idempotency)
      if (processedPaths.has(path)) {
        results.push({
          path,
          action,
          requested: false,
          ok: true,
          statusCode: 200,
          message: 'Skipped (already processed in this run)',
          durationMs: 0,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      const result = await replicateSinglePath(client, path, action, dryRun);
      results.push(result);

      // Mark as processed
      processedPaths.add(path);
    }

    // Throttle between batches (not after last batch)
    if (batchIndex < batches.length - 1 && throttleMs > 0) {
      await sleep(throttleMs);
    }
  }

  return results;
}

/**
 * Perform replication (activation/deactivation) of multiple paths
 *
 * @param client - HTTP client instance
 * @param options - Replication options
 * @returns Replication results
 */
export async function performReplication(
  client: AemHttpClient,
  options: ReplicationOptions,
): Promise<ReplicationOutput> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const timestamp = new Date().toISOString();

  // Track processed paths for idempotency
  const processedPaths = new Set<string>();

  // Deduplicate input paths
  const uniquePaths = [...new Set(opts.paths)];

  // Process all paths
  const results = await processBatches(
    client,
    uniquePaths,
    opts.action,
    opts.batchSize,
    opts.throttleMs,
    opts.dryRun,
    processedPaths,
  );

  // Calculate summary
  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.filter((r) => !r.ok).length;

  return {
    ok: failureCount === 0,
    totalPaths: results.length,
    successCount,
    failureCount,
    dryRun: opts.dryRun,
    results,
    timestamp,
  };
}

/**
 * Activate a list of paths
 *
 * @param client - HTTP client instance
 * @param paths - Paths to activate
 * @param options - Additional options
 * @returns Replication results
 */
export async function activatePaths(
  client: AemHttpClient,
  paths: string[],
  options?: Partial<Omit<ReplicationOptions, 'paths' | 'action'>>,
): Promise<ReplicationOutput> {
  return performReplication(client, {
    ...options,
    paths,
    action: 'activate',
  });
}

/**
 * Deactivate a list of paths
 *
 * @param client - HTTP client instance
 * @param paths - Paths to deactivate
 * @param options - Additional options
 * @returns Replication results
 */
export async function deactivatePaths(
  client: AemHttpClient,
  paths: string[],
  options?: Partial<Omit<ReplicationOptions, 'paths' | 'action'>>,
): Promise<ReplicationOutput> {
  return performReplication(client, {
    ...options,
    paths,
    action: 'deactivate',
  });
}

/**
 * Get replication queue status (for monitoring)
 */
export async function getReplicationQueueStatus(
  client: AemHttpClient,
  agentId: string = 'publish',
): Promise<{
  ok: boolean;
  queueLength: number;
  isBlocked: boolean;
  isPaused: boolean;
}> {
  try {
    const response = await client.get<{
      queue?: { length?: number };
      status?: { isBlocked?: boolean; isPaused?: boolean };
    }>(`${AEM65_ENDPOINTS.replication.agentBase}/${agentId}.queue.json`);

    return {
      ok: true,
      queueLength: response.body?.queue?.length || 0,
      isBlocked: response.body?.status?.isBlocked || false,
      isPaused: response.body?.status?.isPaused || false,
    };
  } catch {
    return {
      ok: false,
      queueLength: -1,
      isBlocked: false,
      isPaused: false,
    };
  }
}
