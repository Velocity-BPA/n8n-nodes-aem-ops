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
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createHttpClient } from '../../core/httpClient';
import type { ReplicationOutput, ReplicationAction } from '../../core/types';
import { parsePathList, validateAemPaths } from '../../core/validation';
import { performReplication } from '../../adapters/aem65/replication';

export class AemReplicate implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AEM Replicate',
    name: 'aemReplicate',
    icon: 'file:aem-replicate.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["action"]}} {{$parameter["pathInputType"]}}',
    description: 'Activate or deactivate AEM content paths',
    defaults: {
      name: 'AEM Replicate',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'aem65Credentials',
        required: true,
        displayOptions: {
          show: {
            credentialType: ['aem65'],
          },
        },
      },
      {
        name: 'aemCloudCredentials',
        required: true,
        displayOptions: {
          show: {
            credentialType: ['aemCloud'],
          },
        },
      },
    ],
    properties: [
      {
        displayName: 'Credential Type',
        name: 'credentialType',
        type: 'options',
        options: [
          {
            name: 'AEM 6.5 (On-Premise)',
            value: 'aem65',
          },
          {
            name: 'AEM Cloud (Coming Soon)',
            value: 'aemCloud',
          },
        ],
        default: 'aem65',
        description: 'The type of AEM instance to connect to',
      },
      {
        displayName: 'Action',
        name: 'action',
        type: 'options',
        options: [
          {
            name: 'Activate',
            value: 'activate',
            description: 'Publish content to publish instances',
          },
          {
            name: 'Deactivate',
            value: 'deactivate',
            description: 'Unpublish content from publish instances',
          },
        ],
        default: 'activate',
        description: 'The replication action to perform',
        required: true,
      },
      {
        displayName: 'Path Input Type',
        name: 'pathInputType',
        type: 'options',
        options: [
          {
            name: 'Manual List',
            value: 'manual',
            description: 'Enter paths manually in a text area',
          },
          {
            name: 'Array',
            value: 'array',
            description: 'Provide paths as a JSON array or from previous node',
          },
        ],
        default: 'manual',
        description: 'How to specify the paths to replicate',
      },
      {
        displayName: 'Paths',
        name: 'pathsText',
        type: 'string',
        typeOptions: {
          rows: 6,
        },
        default: '',
        placeholder: '/content/mysite/en/page1\n/content/mysite/en/page2',
        description:
          'Content paths to replicate. One path per line, or separate with commas/semicolons.',
        displayOptions: {
          show: {
            pathInputType: ['manual'],
          },
        },
      },
      {
        displayName: 'Paths Array',
        name: 'pathsArray',
        type: 'string',
        default: '',
        placeholder: '={{ $json.paths }} or ["path1", "path2"]',
        description:
          'Array of paths to replicate. Can be an expression referencing previous node output.',
        displayOptions: {
          show: {
            pathInputType: ['array'],
          },
        },
      },
      {
        displayName: 'Dry Run',
        name: 'dryRun',
        type: 'boolean',
        default: true,
        description:
          'Whether to simulate the replication without making actual changes. Recommended to test first!',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Batch Size',
            name: 'batchSize',
            type: 'number',
            default: 10,
            description: 'Number of paths to process in each batch',
            typeOptions: {
              minValue: 1,
              maxValue: 100,
            },
          },
          {
            displayName: 'Throttle (ms)',
            name: 'throttleMs',
            type: 'number',
            default: 100,
            description: 'Delay between batches in milliseconds',
            typeOptions: {
              minValue: 0,
              maxValue: 10000,
            },
          },
          {
            displayName: 'Fail Workflow on Error',
            name: 'failOnError',
            type: 'boolean',
            default: false,
            description: 'Whether to fail the entire workflow if any path fails to replicate',
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
        const credentialType = this.getNodeParameter('credentialType', i) as string;

        // Check for AEM Cloud (not implemented)
        if (credentialType === 'aemCloud') {
          throw new NodeOperationError(
            this.getNode(),
            'AEM Cloud support is not yet implemented. Please use AEM 6.5 credentials.',
            {
              itemIndex: i,
              description:
                'AEM as a Cloud Service support is planned for a future release.',
            },
          );
        }

        // Get parameters
        const action = this.getNodeParameter('action', i) as ReplicationAction;
        const pathInputType = this.getNodeParameter('pathInputType', i) as string;
        const dryRun = this.getNodeParameter('dryRun', i) as boolean;
        const options = this.getNodeParameter('options', i) as {
          batchSize?: number;
          throttleMs?: number;
          failOnError?: boolean;
        };

        // Get paths based on input type
        let paths: string[] = [];

        if (pathInputType === 'manual') {
          const pathsText = this.getNodeParameter('pathsText', i) as string;
          paths = parsePathList(pathsText);
        } else {
          const pathsArrayInput = this.getNodeParameter('pathsArray', i);

          if (typeof pathsArrayInput === 'string') {
            // Try to parse as JSON
            try {
              paths = JSON.parse(pathsArrayInput) as string[];
            } catch {
              // If not JSON, try parsing as comma-separated
              paths = parsePathList(pathsArrayInput);
            }
          } else if (Array.isArray(pathsArrayInput)) {
            paths = pathsArrayInput.map((p) => String(p));
          } else {
            throw new NodeOperationError(
              this.getNode(),
              'Paths must be provided as an array or comma-separated string',
              { itemIndex: i },
            );
          }
        }

        // Validate paths
        if (paths.length === 0) {
          throw new NodeOperationError(
            this.getNode(),
            'At least one path is required',
            { itemIndex: i },
          );
        }

        const validation = validateAemPaths(paths);
        if (!validation.valid) {
          throw new NodeOperationError(
            this.getNode(),
            validation.error?.message || 'Invalid paths provided',
            { itemIndex: i },
          );
        }

        // Create HTTP client
        const client = await createHttpClient(this, 'aem65Credentials');

        // Perform replication
        const result: ReplicationOutput = await performReplication(client, {
          paths,
          action,
          dryRun,
          batchSize: options.batchSize,
          throttleMs: options.throttleMs,
        });

        // Check if we should fail on errors
        if (options.failOnError && !result.ok) {
          const failedPaths = result.results
            .filter((r) => !r.ok)
            .map((r) => `${r.path}: ${r.message}`)
            .join('; ');

          throw new NodeOperationError(
            this.getNode(),
            `Replication failed for ${result.failureCount} path(s): ${failedPaths}`,
            { itemIndex: i },
          );
        }

        returnData.push({
          json: { ...result },
          pairedItem: { item: i },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          const errorOutput: ReplicationOutput = {
            ok: false,
            totalPaths: 0,
            successCount: 0,
            failureCount: 0,
            dryRun: false,
            results: [],
            timestamp: new Date().toISOString(),
          };

          // Add error message to the output
          (errorOutput as ReplicationOutput & { error: string }).error =
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
