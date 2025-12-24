/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type {
  CachePurgeOutput,
  PurgeUrlResult,
  PurgeMethod,
  ISOTimestamp,
} from '../../core/types';
import {
  validateUrl,
  validateUrlAgainstAllowlist,
  parsePathList,
} from '../../core/validation';

export class AemCachePurge implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AEM Cache Purge',
    name: 'aemCachePurge',
    icon: 'file:aem-cache-purge.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["method"]}} {{$parameter["urlInputType"]}}',
    description: 'Purge cache from Dispatcher or CDN with URL allowlisting',
    defaults: {
      name: 'AEM Cache Purge',
    },
    inputs: ['main'],
    outputs: ['main'],
    // No AEM credentials needed - this hits Dispatcher/CDN directly
    credentials: [],
    properties: [
      {
        displayName: 'URL Input Type',
        name: 'urlInputType',
        type: 'options',
        options: [
          {
            name: 'Manual List',
            value: 'manual',
            description: 'Enter URLs manually in a text area',
          },
          {
            name: 'Array',
            value: 'array',
            description: 'Provide URLs as a JSON array or from previous node',
          },
        ],
        default: 'manual',
        description: 'How to specify the URLs to purge',
      },
      {
        displayName: 'URLs to Purge',
        name: 'urlsText',
        type: 'string',
        typeOptions: {
          rows: 6,
        },
        default: '',
        placeholder: 'https://www.example.com/content/page1.html\nhttps://www.example.com/content/page2.html',
        description: 'URLs to purge. One URL per line, or separate with commas.',
        displayOptions: {
          show: {
            urlInputType: ['manual'],
          },
        },
      },
      {
        displayName: 'URLs Array',
        name: 'urlsArray',
        type: 'string',
        default: '',
        placeholder: '={{ $json.urls }} or ["url1", "url2"]',
        description:
          'Array of URLs to purge. Can be an expression referencing previous node output.',
        displayOptions: {
          show: {
            urlInputType: ['array'],
          },
        },
      },
      {
        displayName: 'Purge Method',
        name: 'method',
        type: 'options',
        options: [
          {
            name: 'PURGE',
            value: 'PURGE',
            description: 'Send HTTP PURGE request (Varnish, Fastly, etc.)',
          },
          {
            name: 'POST',
            value: 'POST',
            description: 'Send HTTP POST request (some CDNs, Dispatcher flush agent)',
          },
        ],
        default: 'PURGE',
        description: 'HTTP method to use for the purge request',
      },
      {
        displayName: 'Allowlist Regex',
        name: 'allowlistRegex',
        type: 'string',
        default: '',
        placeholder: '^https?://.*\\.example\\.com/.*$',
        description:
          'Regex pattern to validate URLs against. Only URLs matching this pattern will be purged. Leave empty to allow all URLs (not recommended).',
        required: true,
      },
      {
        displayName: 'Dry Run',
        name: 'dryRun',
        type: 'boolean',
        default: true,
        description:
          'Whether to simulate the purge without sending actual requests. Recommended to test first!',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Custom Headers',
            name: 'customHeaders',
            type: 'fixedCollection',
            typeOptions: {
              multipleValues: true,
            },
            default: {},
            options: [
              {
                name: 'header',
                displayName: 'Header',
                values: [
                  {
                    displayName: 'Name',
                    name: 'name',
                    type: 'string',
                    default: '',
                    placeholder: 'X-Purge-Token',
                  },
                  {
                    displayName: 'Value',
                    name: 'value',
                    type: 'string',
                    default: '',
                    placeholder: 'secret-token',
                  },
                ],
              },
            ],
            description: 'Additional headers to send with purge requests (e.g., authentication tokens)',
          },
          {
            displayName: 'Timeout (ms)',
            name: 'timeoutMs',
            type: 'number',
            default: 5000,
            description: 'Request timeout in milliseconds',
            typeOptions: {
              minValue: 1000,
              maxValue: 30000,
            },
          },
          {
            displayName: 'Fail Workflow on Error',
            name: 'failOnError',
            type: 'boolean',
            default: false,
            description: 'Whether to fail the entire workflow if any URL fails to purge',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        // Get parameters
        const urlInputType = this.getNodeParameter('urlInputType', i) as string;
        const method = this.getNodeParameter('method', i) as PurgeMethod;
        const allowlistRegex = this.getNodeParameter('allowlistRegex', i) as string;
        const dryRun = this.getNodeParameter('dryRun', i) as boolean;
        const options = this.getNodeParameter('options', i) as {
          customHeaders?: { header?: Array<{ name: string; value: string }> };
          timeoutMs?: number;
          failOnError?: boolean;
        };

        // Get URLs based on input type
        let urls: string[] = [];

        if (urlInputType === 'manual') {
          const urlsText = this.getNodeParameter('urlsText', i) as string;
          urls = parsePathList(urlsText);
        } else {
          const urlsArrayInput = this.getNodeParameter('urlsArray', i);

          if (typeof urlsArrayInput === 'string') {
            try {
              urls = JSON.parse(urlsArrayInput) as string[];
            } catch {
              urls = parsePathList(urlsArrayInput);
            }
          } else if (Array.isArray(urlsArrayInput)) {
            urls = urlsArrayInput.map((u) => String(u));
          } else {
            throw new NodeOperationError(
              this.getNode(),
              'URLs must be provided as an array or comma-separated string',
              { itemIndex: i },
            );
          }
        }

        // Validate we have URLs
        if (urls.length === 0) {
          throw new NodeOperationError(
            this.getNode(),
            'At least one URL is required',
            { itemIndex: i },
          );
        }

        // Build custom headers
        const customHeaders: Record<string, string> = {};
        if (options.customHeaders?.header) {
          for (const header of options.customHeaders.header) {
            if (header.name && header.value) {
              customHeaders[header.name] = header.value;
            }
          }
        }

        const timeout = options.timeoutMs || 5000;
        const timestamp: ISOTimestamp = new Date().toISOString();

        // Process each URL
        const results: PurgeUrlResult[] = [];
        const processedUrls = new Set<string>();

        for (const url of urls) {
          // Skip duplicates (idempotency)
          if (processedUrls.has(url)) {
            results.push({
              url,
              method,
              requested: false,
              ok: true,
              statusCode: 200,
              message: 'Skipped (duplicate URL in this batch)',
              timestamp,
            });
            continue;
          }
          processedUrls.add(url);

          // Validate URL format
          const urlValidation = validateUrl(url);
          if (!urlValidation.valid) {
            results.push({
              url,
              method,
              requested: false,
              ok: false,
              statusCode: 400,
              message: urlValidation.error?.message || 'Invalid URL format',
              timestamp,
            });
            continue;
          }

          // Validate against allowlist
          const allowlistValidation = validateUrlAgainstAllowlist(url, allowlistRegex);
          if (!allowlistValidation.valid) {
            results.push({
              url,
              method,
              requested: false,
              ok: false,
              statusCode: 403,
              message: allowlistValidation.error?.message || 'URL not in allowlist',
              timestamp,
            });
            continue;
          }

          // Dry run handling
          if (dryRun) {
            results.push({
              url,
              method,
              requested: false,
              ok: true,
              statusCode: 200,
              message: `[DRY RUN] Would send ${method} request`,
              timestamp,
            });
            continue;
          }

          // Send the actual purge request
          try {
            const requestOptions: IHttpRequestOptions = {
              method: method as 'POST' | 'GET',
              url,
              headers: {
                ...customHeaders,
              },
              timeout,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            };

            // For PURGE method, we need to use a workaround since it's not standard
            if (method === 'PURGE') {
              // Most HTTP clients support custom methods
              (requestOptions as { method: string }).method = 'PURGE';
            }

            const response = (await this.helpers.httpRequest(requestOptions)) as {
              statusCode: number;
              body: unknown;
            };

            const ok = response.statusCode >= 200 && response.statusCode < 300;

            results.push({
              url,
              method,
              requested: true,
              ok,
              statusCode: response.statusCode,
              message: ok ? 'Purge successful' : `Purge failed with status ${response.statusCode}`,
              timestamp,
            });
          } catch (error) {
            results.push({
              url,
              method,
              requested: true,
              ok: false,
              statusCode: 0,
              message: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp,
            });
          }
        }

        // Calculate summary
        const successCount = results.filter((r) => r.ok).length;
        const failureCount = results.filter((r) => !r.ok).length;

        const output: CachePurgeOutput = {
          ok: failureCount === 0,
          totalUrls: results.length,
          successCount,
          failureCount,
          dryRun,
          results,
          timestamp,
        };

        // Check if we should fail on errors
        if (options.failOnError && !output.ok) {
          const failedUrls = results
            .filter((r) => !r.ok)
            .map((r) => `${r.url}: ${r.message}`)
            .join('; ');

          throw new NodeOperationError(
            this.getNode(),
            `Cache purge failed for ${failureCount} URL(s): ${failedUrls}`,
            { itemIndex: i },
          );
        }

        returnData.push({
          json: { ...output },
          pairedItem: { item: i },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          const errorOutput: CachePurgeOutput = {
            ok: false,
            totalUrls: 0,
            successCount: 0,
            failureCount: 0,
            dryRun: false,
            results: [],
            timestamp: new Date().toISOString(),
          };

          (errorOutput as CachePurgeOutput & { error: string }).error =
            error instanceof Error ? error.message : 'Unknown error';

          returnData.push({
            json: { ...errorOutput },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
