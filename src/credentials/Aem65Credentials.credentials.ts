/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
  ICredentialType,
  INodeProperties,
  ICredentialTestRequest,
  IAuthenticateGeneric,
} from 'n8n-workflow';

export class Aem65Credentials implements ICredentialType {
  name = 'aem65Credentials';
  displayName = 'AEM 6.5 Credentials';
  documentationUrl = 'https://experienceleague.adobe.com/docs/experience-manager-65/administering/security/security.html';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:4502',
      placeholder: 'https://author.example.com',
      description: 'Base URL of your AEM Author instance (no trailing slash)',
      required: true,
    },
    {
      displayName: 'Authentication Method',
      name: 'authMethod',
      type: 'options',
      options: [
        {
          name: 'Basic Authentication',
          value: 'basic',
          description: 'Username and password authentication',
        },
        {
          name: 'Bearer Token',
          value: 'bearer',
          description: 'Token-based authentication (e.g., service user token)',
        },
      ],
      default: 'basic',
      description: 'The authentication method to use',
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      placeholder: 'admin',
      description: 'AEM username for authentication',
      displayOptions: {
        show: {
          authMethod: ['basic'],
        },
      },
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'AEM password for authentication',
      displayOptions: {
        show: {
          authMethod: ['basic'],
        },
      },
    },
    {
      displayName: 'Bearer Token',
      name: 'bearerToken',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'Bearer token for authentication',
      displayOptions: {
        show: {
          authMethod: ['bearer'],
        },
      },
    },
    {
      displayName: 'Allow Insecure TLS',
      name: 'insecureTls',
      type: 'boolean',
      default: false,
      description:
        'Whether to allow connections to servers with self-signed or invalid certificates. WARNING: Only use in development environments!',
    },
    {
      displayName: 'Enable CSRF Protection',
      name: 'csrfEnabled',
      type: 'boolean',
      default: true,
      description:
        'Whether to fetch and include CSRF tokens for write operations. Recommended for AEM 6.3+.',
    },
  ];

  // Test the credential by making a simple request
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/libs/granite/core/content/login.html',
      method: 'HEAD',
      skipSslCertificateValidation: '={{$credentials.insecureTls}}',
    },
  };

  // Configure authentication based on selected method
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization:
          '={{ $credentials.authMethod === "bearer" ? "Bearer " + $credentials.bearerToken : "Basic " + Buffer.from($credentials.username + ":" + $credentials.password).toString("base64") }}',
      },
    },
  };
}
