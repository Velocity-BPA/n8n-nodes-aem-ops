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
import type { PackageOutput } from '../../core/types';
import { uploadPackage } from '../../adapters/aem65/packageManager';

export class AemPackage implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AEM Package',
    name: 'aemPackage',
    icon: 'file:aem-package.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["install"] ? "Upload & Install" : "Upload Only"}}',
    description: 'Upload and install CRX packages to AEM Package Manager',
    defaults: {
      name: 'AEM Package',
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
        displayName: 'Binary Input',
        name: 'binaryInputType',
        type: 'options',
        options: [
          {
            name: 'From Previous Node',
            value: 'fromPrevious',
            description: 'Use binary data from a previous node (e.g., HTTP Request, Read File)',
          },
          {
            name: 'Binary Property Name',
            value: 'propertyName',
            description: 'Specify the name of the binary property',
          },
        ],
        default: 'fromPrevious',
        description: 'How to get the package binary data',
      },
      {
        displayName: 'Binary Property',
        name: 'binaryProperty',
        type: 'string',
        default: 'data',
        description: 'Name of the binary property containing the package zip file',
        displayOptions: {
          show: {
            binaryInputType: ['propertyName'],
          },
        },
      },
      {
        displayName: 'Package Name',
        name: 'packageName',
        type: 'string',
        default: '',
        placeholder: 'my-package.zip',
        description: 'Optional package name override. If empty, will use original filename.',
      },
      {
        displayName: 'Install After Upload',
        name: 'install',
        type: 'boolean',
        default: false,
        description: 'Whether to install the package after uploading',
      },
      {
        displayName: 'Dry Run',
        name: 'dryRun',
        type: 'boolean',
        default: true,
        description:
          'Whether to simulate the operation without making actual changes. Recommended to test first!',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Fail Workflow on Error',
            name: 'failOnError',
            type: 'boolean',
            default: true,
            description: 'Whether to fail the workflow if package upload or install fails',
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
        const binaryInputType = this.getNodeParameter('binaryInputType', i) as string;
        const packageName = this.getNodeParameter('packageName', i) as string;
        const install = this.getNodeParameter('install', i) as boolean;
        const dryRun = this.getNodeParameter('dryRun', i) as boolean;
        const options = this.getNodeParameter('options', i) as {
          failOnError?: boolean;
        };

        // Get binary data
        let binaryPropertyName = 'data';

        if (binaryInputType === 'propertyName') {
          binaryPropertyName = this.getNodeParameter('binaryProperty', i) as string;
        } else {
          // Find the first binary property
          const binaryKeys = Object.keys(items[i].binary || {});
          if (binaryKeys.length > 0) {
            binaryPropertyName = binaryKeys[0];
          }
        }

        // Check if binary data exists
        if (!items[i].binary || !items[i].binary![binaryPropertyName]) {
          throw new NodeOperationError(
            this.getNode(),
            `No binary data found in property "${binaryPropertyName}". Make sure a previous node provides the package file.`,
            { itemIndex: i },
          );
        }

        // Get the binary data as Buffer
        const binaryData = items[i].binary![binaryPropertyName];
        const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

        // Determine package name
        const finalPackageName = packageName || binaryData.fileName || 'package.zip';

        // Create HTTP client
        const client = await createHttpClient(this, 'aem65Credentials');

        // Upload (and optionally install) the package
        const result: PackageOutput = await uploadPackage(client, buffer, {
          packageName: finalPackageName,
          install,
          dryRun,
        });

        // Check if we should fail on errors
        if (options.failOnError !== false && !result.ok) {
          throw new NodeOperationError(
            this.getNode(),
            `Package operation failed: ${result.logs.join('; ')}`,
            { itemIndex: i },
          );
        }

        returnData.push({
          json: { ...result },
          pairedItem: { item: i },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          const errorOutput: PackageOutput = {
            ok: false,
            statusCode: 0,
            uploaded: false,
            installed: false,
            packageId: null,
            packageName: '',
            logs: [error instanceof Error ? error.message : 'Unknown error'],
            dryRun: false,
            timestamp: new Date().toISOString(),
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
