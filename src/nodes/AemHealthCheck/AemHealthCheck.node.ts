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
import type { HealthCheckOutput } from '../../core/types';
import { performHealthCheck } from '../../adapters/aem65/healthCheck';

export class AemHealthCheck implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AEM Health Check',
    name: 'aemHealthCheck',
    icon: 'file:aem-health-check.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["healthEndpoint"] || "/system/health"}}',
    description: 'Perform a health check against an AEM instance',
    defaults: {
      name: 'AEM Health Check',
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
        displayName: 'Health Endpoint',
        name: 'healthEndpoint',
        type: 'string',
        default: '/system/health',
        placeholder: '/system/health',
        description:
          'The health check endpoint path to query. Common options: /system/health (requires auth), /libs/granite/core/content/login.html (public readiness)',
      },
      {
        displayName: 'Timeout (ms)',
        name: 'timeoutMs',
        type: 'number',
        default: 10000,
        description: 'Request timeout in milliseconds',
        typeOptions: {
          minValue: 1000,
          maxValue: 60000,
        },
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Fail Workflow on Unhealthy',
            name: 'failOnUnhealthy',
            type: 'boolean',
            default: false,
            description:
              'Whether to fail the workflow if the health check returns unhealthy status',
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
                'AEM as a Cloud Service support is planned for a future release. Currently, only AEM 6.5 on-premise is supported.',
            },
          );
        }

        // Get parameters
        const healthEndpoint = this.getNodeParameter('healthEndpoint', i) as string;
        const timeoutMs = this.getNodeParameter('timeoutMs', i) as number;
        const options = this.getNodeParameter('options', i) as {
          failOnUnhealthy?: boolean;
        };

        // Create HTTP client
        const client = await createHttpClient(this, 'aem65Credentials');

        // Perform health check
        const result: HealthCheckOutput = await performHealthCheck(client, {
          healthEndpoint,
          timeoutMs,
        });

        // Check if we should fail on unhealthy
        if (options.failOnUnhealthy && !result.ok) {
          throw new NodeOperationError(
            this.getNode(),
            `AEM health check failed: ${result.notes.join('; ')}`,
            {
              itemIndex: i,
              description: `Status code: ${result.statusCode}, URL: ${result.checkedUrl}`,
            },
          );
        }

        returnData.push({
          json: { ...result },
          pairedItem: { item: i },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          const errorOutput: HealthCheckOutput = {
            ok: false,
            statusCode: 0,
            latencyMs: 0,
            checkedUrl: '',
            timestamp: new Date().toISOString(),
            notes: [error instanceof Error ? error.message : 'Unknown error'],
          };
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
