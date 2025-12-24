# n8n-nodes-aem-ops

> [Velocity BPA Licensing Notice]
>
> This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
>
> Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.
>
> For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.

---

[![npm version](https://badge.fury.io/js/n8n-nodes-aem-ops.svg)](https://www.npmjs.com/package/n8n-nodes-aem-ops)
[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-blue.svg)](LICENSE)

**n8n community nodes for Adobe Experience Manager (AEM) operations** - Health checks, content replication, package management, and cache purging.

![AEM Ops Nodes](https://img.shields.io/badge/AEM-6.5%20On--Prem-red?logo=adobe)
![n8n](https://img.shields.io/badge/n8n-community%20node-orange)

## Table of Contents

- [Licensing](#licensing)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Local Development Install](#local-development-install)
  - [Production Install](#production-install)
- [Building from Source](#building-from-source)
- [Nodes](#nodes)
  - [AEM Health Check](#aem-health-check)
  - [AEM Replicate](#aem-replicate)
  - [AEM Package](#aem-package)
  - [AEM Cache Purge](#aem-cache-purge)
- [Credentials](#credentials)
- [Workflow Templates](#workflow-templates)
- [Slack Integration Setup](#slack-integration-setup)
- [Safety Features](#safety-features)
- [Architecture](#architecture)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

---

## Licensing

This n8n community node is licensed under the **Business Source License 1.1**.

### Free Use
Permitted for personal, educational, research, and internal business use.

### Commercial Use
Use of this node within any SaaS, PaaS, hosted platform, managed service,
or paid automation offering requires a commercial license.

For licensing inquiries:
**licensing@velobpa.com**

See also:
- [LICENSE](LICENSE)
- [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)
- [LICENSING_FAQ.md](LICENSING_FAQ.md)

---

## Features

- ✅ **AEM Health Check** - Lightweight readiness checks against AEM Author
- ✅ **AEM Replicate** - Activate/deactivate content with batching and throttling
- ✅ **AEM Package** - Upload and install CRX packages
- ✅ **AEM Cache Purge** - Dispatcher/CDN cache invalidation with URL allowlisting
- ✅ **Dry Run Mode** - All write operations support simulation
- ✅ **Consistent Output Schemas** - Easy to chain across workflows
- ✅ **Secure by Default** - Credential redaction, URL validation, allowlisting

---

## Prerequisites

- **Node.js**: >= 18.10.0
- **npm**: >= 9.0.0
- **n8n**: >= 1.0.0 (running via npm/npx, not Docker)
- **AEM**: 6.5 on-premise (AEMaaCS support planned)

---

## Installation

### Local Development Install

#### Step 1: Extract and Build

```bash
# Extract the package
unzip n8n-nodes-aem-ops.zip -d n8n-nodes-aem-ops
cd n8n-nodes-aem-ops

# Install dependencies
npm install

# Build the package
npm run build
```

#### Step 2: Link to n8n

**Option A: Using N8N_CUSTOM_EXTENSIONS (Recommended)**

```bash
# Get the absolute path to your project
PACKAGE_PATH=$(pwd)

# Start n8n with custom extensions
N8N_CUSTOM_EXTENSIONS=$PACKAGE_PATH npx n8n start
```

**Option B: Using ~/.n8n/custom directory**

```bash
# Create the custom nodes directory if it doesn't exist
mkdir -p ~/.n8n/custom

# Copy or symlink the built package
cp -r dist/* ~/.n8n/custom/
# OR create a symlink (better for development)
ln -s $(pwd)/dist ~/.n8n/custom/n8n-nodes-aem-ops

# Start n8n normally
npx n8n start
```

**Option C: npm link (Global Development)**

```bash
# In the package directory
npm link

# Link to your n8n installation
cd ~/.n8n
npm link n8n-nodes-aem-ops

# Start n8n
npx n8n start
```

#### Step 3: Verify Installation

1. Open n8n in your browser (default: http://localhost:5678)
2. Create a new workflow
3. Search for "AEM" in the nodes panel
4. You should see: AEM Health Check, AEM Replicate, AEM Package, AEM Cache Purge

### Production Install

```bash
# Install from npm (when published)
cd ~/.n8n
npm install n8n-nodes-aem-ops

# Restart n8n
```

---

## Building from Source

```bash
# Clean previous build
npm run clean

# Build TypeScript
npm run build

# Run type checking only
npm run typecheck

# Lint code
npm run lint

# Format code
npm run format
```

### Creating a Distribution ZIP

```bash
# Build the package
npm run build

# Create a zip for distribution
zip -r n8n-nodes-aem-ops.zip dist package.json README.md LICENSE COMMERCIAL_LICENSE.md LICENSING_FAQ.md
```

---

## Nodes

### AEM Health Check

Performs a lightweight readiness check against an AEM Author instance.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Credential Type | select | aem65 | AEM 6.5 or Cloud (stub) |
| Health Endpoint | string | /system/health | Endpoint path to check |
| Timeout (ms) | number | 10000 | Request timeout |
| Fail on Unhealthy | boolean | false | Fail workflow if unhealthy |

**Output Schema:**
```json
{
  "ok": true,
  "statusCode": 200,
  "latencyMs": 145,
  "checkedUrl": "http://localhost:4502/system/health",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "notes": ["System status: OK"]
}
```

---

### AEM Replicate

Activates or deactivates AEM content paths with batching and throttling.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Action | select | activate | activate or deactivate |
| Path Input Type | select | manual | manual or array |
| Paths | string/array | - | Content paths to replicate |
| Dry Run | boolean | true | Simulate without changes |
| Batch Size | number | 10 | Paths per batch |
| Throttle (ms) | number | 100 | Delay between batches |

**Output Schema:**
```json
{
  "ok": true,
  "totalPaths": 3,
  "successCount": 3,
  "failureCount": 0,
  "dryRun": false,
  "results": [
    {
      "path": "/content/mysite/en/home",
      "action": "activate",
      "requested": true,
      "ok": true,
      "statusCode": 200,
      "message": "Successfully activated",
      "durationMs": 234,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:01.000Z"
}
```

---

### AEM Package

Uploads and optionally installs CRX packages to AEM Package Manager.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Binary Input Type | select | fromPrevious | Source of package file |
| Binary Property | string | data | Binary property name |
| Package Name | string | - | Optional name override |
| Install After Upload | boolean | false | Install after upload |
| Dry Run | boolean | true | Simulate without changes |

**Output Schema:**
```json
{
  "ok": true,
  "statusCode": 200,
  "uploaded": true,
  "installed": true,
  "packageId": "/etc/packages/my-group/my-package-1.0.zip",
  "packageName": "my-package-1.0.zip",
  "logs": ["Package uploaded successfully", "Package installed successfully"],
  "dryRun": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### AEM Cache Purge

Purges cache from Dispatcher or CDN with strict URL allowlisting.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| URL Input Type | select | manual | manual or array |
| URLs to Purge | string/array | - | URLs to purge |
| Purge Method | select | PURGE | PURGE or POST |
| Allowlist Regex | string | - | **Required** - URL validation pattern |
| Dry Run | boolean | true | Simulate without changes |
| Custom Headers | collection | - | Additional headers (auth tokens) |

**Output Schema:**
```json
{
  "ok": true,
  "totalUrls": 2,
  "successCount": 2,
  "failureCount": 0,
  "dryRun": false,
  "results": [
    {
      "url": "https://www.example.com/page.html",
      "method": "PURGE",
      "requested": true,
      "ok": true,
      "statusCode": 200,
      "message": "Purge successful",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:01.000Z"
}
```

---

## Credentials

### AEM 6.5 Credentials

1. In n8n, go to **Settings** → **Credentials**
2. Click **Add Credential** → Search for "AEM 6.5"
3. Configure:

| Field | Description | Example |
|-------|-------------|---------|
| Base URL | AEM Author instance URL | `http://localhost:4502` |
| Auth Method | Basic or Bearer | `basic` |
| Username | AEM username | `admin` |
| Password | AEM password | `admin` |
| Allow Insecure TLS | Dev only - skip cert validation | `false` |
| Enable CSRF | Fetch CSRF tokens for POSTs | `true` |

### AEM Cloud Credentials (Stub)

AEM as a Cloud Service support is **coming soon**. The credential type exists to demonstrate extensibility. Selecting it will return a "not implemented" error.

---

## Workflow Templates

Two workflow templates are included in the `workflows/` directory:

### Template A: AEM Release Gate (MVP)

**File:** `workflows/template-a-aem-release-gate.json`

A deployment pipeline that:
1. Manual trigger
2. Health check (fail if unhealthy)
3. Replicate sample paths
4. Purge cache
5. Send Slack notification

### Template B: AEM Nightly Ops Check

**File:** `workflows/template-b-aem-nightly-ops-check.json`

Scheduled monitoring that:
1. Cron trigger (2 AM nightly)
2. Health check
3. If unhealthy → Alert Slack channel

### Importing Templates

1. In n8n, go to **Workflows**
2. Click **Import from File**
3. Select the JSON template file
4. Update credential references (replace `YOUR_CREDENTIAL_ID`)
5. Update Slack channel and other parameters as needed

---

## Slack Integration Setup

The workflow templates use n8n's built-in Slack node. To set it up:

### Step 1: Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name it (e.g., "n8n AEM Ops") and select your workspace

### Step 2: Configure OAuth Scopes

1. Go to **OAuth & Permissions**
2. Add these **Bot Token Scopes**:
   - `chat:write` - Send messages
   - `chat:write.public` - Send to public channels
3. Click **Install to Workspace**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### Step 3: Add Credential in n8n

1. In n8n, go to **Settings** → **Credentials**
2. Click **Add Credential** → Search for "Slack"
3. Choose **OAuth2** or **Access Token**
4. Paste your Bot Token
5. Test the connection

### Step 4: Invite Bot to Channel

In Slack, invite the bot to your channel:
```
/invite @your-bot-name
```

---

## Safety Features

All "write" nodes include safety guardrails:

| Feature | Description |
|---------|-------------|
| **Dry Run** | Default `true` - simulates operations without changes |
| **Batch Size** | Limits concurrent operations |
| **Throttle** | Delays between batches to prevent overload |
| **Idempotency** | Skips duplicate paths/URLs in same execution |
| **URL Allowlist** | Regex validation for cache purge URLs |
| **Path Validation** | Validates AEM paths (no traversal, valid format) |
| **Credential Redaction** | Never logs auth headers, tokens, or passwords |
| **Retry with Backoff** | Automatic retry for 429/503 errors |

---

## Architecture

```
n8n-nodes-aem-ops/
├── src/
│   ├── core/                    # Shared utilities
│   │   ├── types.ts            # Output schema types
│   │   ├── httpClient.ts       # HTTP wrapper with retry
│   │   ├── validation.ts       # URL/path validators
│   │   ├── redaction.ts        # Sensitive data redaction
│   │   └── retry.ts            # Retry/backoff logic
│   │
│   ├── adapters/
│   │   └── aem65/              # AEM 6.5 specific logic
│   │       ├── healthCheck.ts  # Health API
│   │       ├── replication.ts  # Replication API
│   │       └── packageManager.ts # Package Manager API
│   │
│   ├── credentials/            # n8n credential types
│   │   ├── Aem65Credentials.credentials.ts
│   │   └── AemCloudCredentials.credentials.ts
│   │
│   ├── nodes/                  # n8n node implementations
│   │   ├── AemHealthCheck/
│   │   ├── AemReplicate/
│   │   ├── AemPackage/
│   │   └── AemCachePurge/
│   │
│   └── index.ts               # Main exports
│
├── workflows/                  # Importable templates
├── dist/                      # Built output
└── package.json
```

### Adapter Pattern

Nodes call adapter functions rather than hardcoding endpoints. This enables:
- Easy addition of AEMaaCS support
- Testable business logic
- Consistent error handling

---

## Development

### Watch Mode

```bash
npm run dev
```

### Linting & Formatting

```bash
npm run lint
npm run lint:fix
npm run format
```

### Type Checking

```bash
npm run typecheck
```

---

## Troubleshooting

### Nodes Not Appearing

1. Verify build completed: `ls dist/`
2. Check n8n logs for loading errors
3. Ensure correct path in `N8N_CUSTOM_EXTENSIONS`
4. Restart n8n after changes

### Authentication Failures

1. Verify AEM is running and accessible
2. Check credentials in n8n
3. Try accessing the health endpoint directly in browser
4. Check if CSRF is required (AEM 6.3+)

### CSRF Token Errors

Enable CSRF in credentials if you see 403 errors on POST requests.

### Connection Timeouts

1. Increase timeout in node parameters
2. Check network connectivity to AEM
3. Verify AEM isn't under heavy load

### Package Upload Fails

1. Verify file is a valid CRX zip
2. Check Package Manager permissions
3. Ensure enough disk space on AEM

---

## Support

- **Licensing**: licensing@velobpa.com
- **Website**: https://velobpa.com
- **n8n Community**: [community.n8n.io](https://community.n8n.io)

---

**Copyright © Velocity BPA, LLC. All rights reserved.**
