/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * AEM Cloud (AEMaaCS) Credentials - STUB
 *
 * This credential type is included to demonstrate extensibility
 * and establish the pattern for future AEMaaCS support.
 *
 * When selected, nodes will return a "not implemented" error.
 */
export class AemCloudCredentials implements ICredentialType {
  name = 'aemCloudCredentials';
  displayName = 'AEM Cloud Credentials (Coming Soon)';
  documentationUrl =
    'https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/overview/introduction.html';

  properties: INodeProperties[] = [
    {
      displayName: 'Notice',
      name: 'notice',
      type: 'notice',
      default: '',
      description:
        'AEM as a Cloud Service support is coming soon. This credential type is a placeholder for future functionality.',
    },
    {
      displayName: 'IMS Organization ID',
      name: 'imsOrgId',
      type: 'string',
      default: '',
      placeholder: 'XXXXXXXXXXXXXXXX@AdobeOrg',
      description: 'Your Adobe IMS Organization ID',
      required: true,
    },
    {
      displayName: 'Program ID',
      name: 'programId',
      type: 'string',
      default: '',
      placeholder: '12345',
      description: 'Cloud Manager Program ID',
      required: true,
    },
    {
      displayName: 'Environment ID',
      name: 'environmentId',
      type: 'string',
      default: '',
      placeholder: '67890',
      description: 'Cloud Manager Environment ID',
      required: true,
    },
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: '',
      description: 'IMS Service Account Client ID',
      required: true,
    },
    {
      displayName: 'Client Secret',
      name: 'clientSecret',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'IMS Service Account Client Secret',
      required: true,
    },
    {
      displayName: 'Technical Account ID',
      name: 'technicalAccountId',
      type: 'string',
      default: '',
      placeholder: 'XXXXXXXXXXXXXXXX@techacct.adobe.com',
      description: 'Technical Account ID for service account authentication',
    },
    {
      displayName: 'Private Key',
      name: 'privateKey',
      type: 'string',
      typeOptions: {
        password: true,
        rows: 5,
      },
      default: '',
      description: 'Private key for JWT authentication (PEM format)',
    },
  ];

  // No test for stub credential
}
