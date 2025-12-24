/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * HTTP Client Wrapper
 * Wraps n8n's HTTP helpers with retry, redaction, and consistent error handling
 */

import type { IExecuteFunctions, IHttpRequestOptions, IHttpRequestMethods } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import type { Aem65Credentials, HttpResponse, AemErrorDetails } from './types';
import { AemErrorCode } from './types';
import { withRetry, DEFAULT_RETRY_CONFIG, type RetryConfig } from './retry';
import { redactUrl, redactErrorMessage } from './redaction';
import { normalizeBaseUrl } from './validation';

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  /** Credentials for authentication */
  credentials: Aem65Credentials;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Default timeout in milliseconds */
  defaultTimeoutMs?: number;
}

/**
 * Request options for the HTTP client
 */
export interface RequestOptions {
  /** HTTP method */
  method: IHttpRequestMethods;
  /** URL path (relative to base URL) or full URL */
  url: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Form data */
  formData?: Record<string, unknown>;
  /** Query parameters */
  qs?: Record<string, string | number | boolean>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Return full response instead of just body */
  returnFullResponse?: boolean;
  /** Skip retry logic */
  skipRetry?: boolean;
}

/**
 * CSRF token cache
 */
interface CsrfTokenCache {
  token: string;
  expiresAt: number;
}

/**
 * Create a configured HTTP client for AEM requests
 */
export class AemHttpClient {
  private context: IExecuteFunctions;
  private credentials: Aem65Credentials;
  private retryConfig: RetryConfig;
  private defaultTimeoutMs: number;
  private csrfCache: CsrfTokenCache | null = null;

  constructor(context: IExecuteFunctions, config: HttpClientConfig) {
    this.context = context;
    this.credentials = config.credentials;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
  }

  /**
   * Build the full URL from a path
   */
  private buildUrl(urlOrPath: string): string {
    // If it's already a full URL, return as-is
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      return urlOrPath;
    }

    // Build from base URL
    const baseUrl = normalizeBaseUrl(this.credentials.baseUrl);
    const path = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
    return `${baseUrl}${path}`;
  }

  /**
   * Get authentication headers based on credential type
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.credentials.authMethod === 'basic') {
      const username = this.credentials.username ?? '';
      const password = this.credentials.password ?? '';
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    } else if (this.credentials.authMethod === 'bearer') {
      const token = this.credentials.bearerToken ?? '';
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Fetch CSRF token from AEM (if enabled)
   */
  async getCsrfToken(): Promise<string | null> {
    if (!this.credentials.csrfEnabled) {
      return null;
    }

    // Check cache
    if (this.csrfCache && this.csrfCache.expiresAt > Date.now()) {
      return this.csrfCache.token;
    }

    try {
      const response = await this.request<string>({
        method: 'GET',
        url: '/libs/granite/csrf/token.json',
        skipRetry: true,
        returnFullResponse: true,
      });

      const body = response.body as unknown as { token?: string };
      if (body && typeof body === 'object' && 'token' in body) {
        const token = body.token as string;
        // Cache for 5 minutes
        this.csrfCache = {
          token,
          expiresAt: Date.now() + 5 * 60 * 1000,
        };
        return token;
      }
    } catch {
      // CSRF token fetch failed - continue without it
    }

    return null;
  }

  /**
   * Make an HTTP request with retry and error handling
   */
  async request<T = unknown>(options: RequestOptions): Promise<HttpResponse<T>> {
    const startTime = Date.now();
    const fullUrl = this.buildUrl(options.url);

    // Build request options
    const requestOptions: IHttpRequestOptions = {
      method: options.method,
      url: fullUrl,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      timeout: options.timeout ?? this.defaultTimeoutMs,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    };

    // Add body or form data
    if (options.body) {
      requestOptions.body = options.body;
      if (!requestOptions.headers?.['Content-Type']) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json',
        };
      }
    }

    if (options.formData) {
      requestOptions.body = options.formData;
      requestOptions.headers = {
        ...requestOptions.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
    }

    if (options.qs) {
      requestOptions.qs = options.qs;
    }

    // Handle insecure TLS
    if (this.credentials.insecureTls) {
      requestOptions.skipSslCertificateValidation = true;
    }

    // Add CSRF token for write operations
    if (['POST', 'PUT', 'DELETE'].includes(options.method)) {
      const csrfToken = await this.getCsrfToken();
      if (csrfToken) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'CSRF-Token': csrfToken,
        };
      }
    }

    // Execute with or without retry
    const executeRequest = async () => {
      const response = await this.context.helpers.httpRequest(requestOptions);
      const latencyMs = Date.now() - startTime;

      // Type assertion for the response
      const fullResponse = response as {
        statusCode: number;
        headers: Record<string, string>;
        body: T;
      };

      // Check for error status codes
      if (fullResponse.statusCode >= 400) {
        const error = this.createError(fullResponse.statusCode, fullUrl, fullResponse.body);
        (error as { statusCode?: number }).statusCode = fullResponse.statusCode;
        throw error;
      }

      return {
        statusCode: fullResponse.statusCode,
        headers: fullResponse.headers || {},
        body: fullResponse.body,
        latencyMs,
      };
    };

    if (options.skipRetry) {
      return executeRequest();
    }

    return withRetry(executeRequest, this.retryConfig);
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(
    url: string,
    options?: Omit<RequestOptions, 'method' | 'url'>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: 'GET', url });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'url' | 'body'>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: 'POST', url, body });
  }

  /**
   * Make a POST request with form data
   */
  async postForm<T = unknown>(
    url: string,
    formData: Record<string, unknown>,
    options?: Omit<RequestOptions, 'method' | 'url' | 'formData'>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: 'POST', url, formData });
  }

  /**
   * Upload a file with multipart/form-data
   */
  async uploadFile<T = unknown>(
    url: string,
    fileData: Buffer,
    fileName: string,
    additionalFields?: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    const startTime = Date.now();
    const fullUrl = this.buildUrl(url);

    // Get CSRF token
    const csrfToken = await this.getCsrfToken();

    const headers: Record<string, string> = {
      ...this.getAuthHeaders(),
    };

    if (csrfToken) {
      headers['CSRF-Token'] = csrfToken;
    }

    // Build multipart form data
    const formData: Record<string, unknown> = {
      file: {
        value: fileData,
        options: {
          filename: fileName,
          contentType: 'application/zip',
        },
      },
      ...additionalFields,
    };

    const requestOptions: IHttpRequestOptions = {
      method: 'POST',
      url: fullUrl,
      headers,
      body: formData,
      timeout: this.defaultTimeoutMs,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
      json: false,
    };

    if (this.credentials.insecureTls) {
      requestOptions.skipSslCertificateValidation = true;
    }

    const response = await this.context.helpers.httpRequest(requestOptions);
    const latencyMs = Date.now() - startTime;

    const fullResponse = response as {
      statusCode: number;
      headers: Record<string, string>;
      body: T;
    };

    if (fullResponse.statusCode >= 400) {
      const error = this.createError(fullResponse.statusCode, fullUrl, fullResponse.body);
      throw error;
    }

    return {
      statusCode: fullResponse.statusCode,
      headers: fullResponse.headers || {},
      body: fullResponse.body,
      latencyMs,
    };
  }

  /**
   * Create a structured error from an HTTP response
   */
  private createError(statusCode: number, url: string, body: unknown): NodeApiError {
    const details = this.getErrorDetails(statusCode, url, body);

    return new NodeApiError(this.context.getNode(), {
      message: details.message,
      description: redactErrorMessage(JSON.stringify(body)),
      httpCode: String(statusCode),
    });
  }

  /**
   * Get detailed error information based on status code
   */
  private getErrorDetails(statusCode: number, url: string, body: unknown): AemErrorDetails {
    const safeUrl = redactUrl(url);

    switch (statusCode) {
      case 401:
        return {
          code: AemErrorCode.AUTHENTICATION_FAILED,
          message: 'Authentication failed. Check your credentials.',
          statusCode,
          url: safeUrl,
        };
      case 403:
        return {
          code: AemErrorCode.FORBIDDEN,
          message: 'Access forbidden. Check user permissions.',
          statusCode,
          url: safeUrl,
        };
      case 404:
        return {
          code: AemErrorCode.HEALTH_CHECK_FAILED,
          message: 'Resource not found. Check the URL or path.',
          statusCode,
          url: safeUrl,
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: AemErrorCode.CONNECTION_FAILED,
          message: `Server error (${statusCode}). The AEM instance may be unavailable.`,
          statusCode,
          url: safeUrl,
        };
      default:
        return {
          code: AemErrorCode.CONNECTION_FAILED,
          message: `Request failed with status ${statusCode}`,
          statusCode,
          url: safeUrl,
          context: { body: typeof body === 'string' ? body.substring(0, 200) : undefined },
        };
    }
  }
}

/**
 * Create an HTTP client from execution context
 */
export async function createHttpClient(
  context: IExecuteFunctions,
  credentialType: string = 'aem65Credentials',
): Promise<AemHttpClient> {
  const credentials = (await context.getCredentials(credentialType)) as unknown as Aem65Credentials;

  return new AemHttpClient(context, {
    credentials,
  });
}

/**
 * Create an HTTP client with explicit credentials
 */
export function createHttpClientWithCredentials(
  context: IExecuteFunctions,
  credentials: Aem65Credentials,
): AemHttpClient {
  return new AemHttpClient(context, { credentials });
}
