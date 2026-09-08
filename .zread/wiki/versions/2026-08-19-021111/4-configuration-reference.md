This page is the definitive reference for every configuration surface in copilot-api. It covers the JSON configuration file, CLI options, environment variables, and provider-level model settings. Each entry includes its type, default value, and the source file where the behavior is defined.

For a quick setup guide, see [Quick Start](2-quick-start). For Docker-specific configuration, see [Docker Deployment](5-docker-deployment).

---

## Configuration File

The primary configuration mechanism is a JSON file stored at a well-known path. On first run, the application creates this file automatically with sensible defaults and sets its permissions to `0o600` (owner read/write only).

| Property | Value |
|---|---|
| **Default path** | `~/.local/share/copilot-api/config.json` |
| **Custom path** | Set via `--api-home` CLI flag or `COPILOT_API_HOME` env var |
| **Format** | JSON |
| **Auto-created** | Yes, on first startup |
| **Permissions** | `0o600` (owner-only) |

The resolved path is constructed in [src/lib/paths.ts](src/lib/paths.ts#L5-L17):

```
$APP_DIR/config.json
```

Where `$APP_DIR` defaults to `~/.local/share/copilot-api` but is overridden by the `COPILOT_API_HOME` environment variable or the `--api-home` CLI argument.

The file is read at startup, merged with built-in defaults, and any missing keys (like extra prompts, reasoning efforts, or admin API keys) are automatically backfilled and persisted. This means the config file on disk is always kept in sync with the application's expectations after the first run — see [src/lib/config.ts](src/lib/config.ts#L320-L346) for the merge logic.

---

## Top-Level Configuration Keys

Below is the complete `AppConfig` interface with every supported top-level key. The TypeScript definition lives at [src/lib/config.ts](src/lib/config.ts#L7-L34).

| Key | Type | Default | Description |
|---|---|---|---|
| `auth` | `object` | `{ apiKeys: [] }` | Authentication settings for the server |
| `providers` | `Record<string, ProviderConfig>` | `{}` | Third-party provider definitions (see [Third-Party Provider Configuration and Proxying](15-third-party-provider-configuration-and-proxying)) |
| `modelMappings` | `Record<string, string>` | `{}` | Model aliasing map — request model `X` and it is transparently replaced with `Y` |
| `extraPrompts` | `Record<string, string>` | *(see below)* | Per-model system prompt extensions injected automatically |
| `smallModel` | `string` | `"gpt-5-mini"` | Model used for lightweight/summarization tasks (e.g., context compaction) |
| `useResponsesApiContextManagement` | `boolean` | `true` | Enable automatic context compaction when conversations approach token limits |
| `modelResponsesApiCompactThresholds` | `Record<string, number>` | *(see below)* | Per-model token count thresholds that trigger automatic compaction |
| `modelReasoningEfforts` | `Record<string, string>` | *(see below)* | Per-model reasoning effort level |
| `useMessagesApi` | `boolean` | `true` | Enable the Anthropic-compatible `/v1/messages` endpoint |
| `useResponsesApiWebSocket` | `boolean` | `true` | Enable WebSocket transport for the OpenAI Responses endpoint |
| `anthropicApiKey` | `string` | `undefined` | Direct Anthropic API key (also falls back to `ANTHROPIC_API_KEY` env var) |
| `useResponsesApiWebSearch` | `boolean` | `true` | Enable the web search tool in the Responses endpoint |
| `messageApiWebSearchModel` | `string` | `"gpt-5-mini"` | Model used for web search when invoked through the Messages API |
| `claudeTokenMultiplier` | `number` | `1.15` | Multiplier applied to Claude model token counts for billing accuracy |

Sources: [src/lib/config.ts](src/lib/config.ts#L7-L34), [src/lib/config.ts](src/lib/config.ts#L105-L132)

---

## Authentication Configuration (`auth`)

The `auth` block controls who can access the server and who can manage it.

### `auth.apiKeys`

An array of strings. When non-empty, every incoming request to the server (except explicitly excluded paths like `/` and `/usage-viewer`) must present one of these keys via the `Authorization: Bearer <key>` header or the `x-api-key` header. When the array is empty, all requests are allowed through without authentication.

```json
{
  "auth": {
    "apiKeys": ["my-secret-key-1", "my-secret-key-2"]
  }
}
```

Sources: [src/lib/request-auth.ts](src/lib/request-auth.ts#L15-L40), [src/lib/request-auth.ts](src/lib/request-auth.ts#L57-L75)

### `auth.adminApiKey`

A single string that gates access to all `/admin/*` routes (currently the model-mappings configuration API). If you do not set this value, the application **auto-generates a random 64-character hex string** on first startup and persists it into the config file. You can retrieve it from `config.json` or by running the `debug` command.

The admin key is validated by a separate auth middleware that **always requires authentication** — there is no bypass even if `auth.apiKeys` is empty.

```json
{
  "auth": {
    "adminApiKey": "your-custom-admin-key"
  }
}
```

Sources: [src/lib/config.ts](src/lib/config.ts#L136-L159), [src/lib/request-auth.ts](src/lib/request-auth.ts#L51-L55), [src/server.ts](src/server.ts#L37-L44)

---

## Provider Configuration (`providers`)

The `providers` object is a map of named provider definitions. Each key is a provider name you choose (except `"copilot"`, which is reserved). These providers enable routing requests to third-party API services like Anthropic, OpenAI, or any OpenAI-compatible endpoint.

Sources: [src/lib/config.ts](src/lib/config.ts#L53-L61), [src/lib/config.ts](src/lib/config.ts#L614-L616)

### Provider Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `string` | No | `"anthropic"` | Provider protocol type. Valid values: `"anthropic"`, `"openai-compatible"`, `"openai-responses"` |
| `enabled` | `boolean` | No | `true` | Set to `false` to temporarily disable a provider without deleting its config |
| `baseUrl` | `string` | **Yes** | — | Base URL of the provider's API (trailing slashes are stripped automatically) |
| `apiKey` | `string` | **Yes*** | — | API key for the provider. *Not required for `codex` provider with `oauth2` auth |
| `authType` | `string` | No | *auto* | Authentication method. Valid values: `"authorization"`, `"x-api-key"`, `"oauth2"`. Defaults to `"x-api-key"` for Anthropic type, `"authorization"` for others. `"oauth2"` is only valid for the `codex` provider |
| `models` | `Record<string, ModelConfig>` | No | — | Per-model configuration overrides (see [Model Configuration](#model-configuration)) |
| `adjustInputTokens` | `boolean` | No | — | Provider-specific token adjustment flag |

Sources: [src/lib/config.ts](src/lib/config.ts#L53-L61), [src/lib/config.ts](src/lib/config.ts#L542-L606)

### Provider Type Summary

| Provider Type | Description | Default Auth |
|---|---|---|
| `"anthropic"` | Anthropic-compatible API | `x-api-key` |
| `"openai-compatible"` | Any OpenAI-compatible API (OpenRouter, etc.) | `authorization` |
| `"openai-responses"` | OpenAI Responses API with WebSocket support | `authorization` |

### Example: Adding an Anthropic Provider

```json
{
  "providers": {
    "my-anthropic": {
      "type": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "sk-ant-..."
    }
  }
}
```

### Example: Adding an OpenAI-Compatible Provider

```json
{
  "providers": {
    "openrouter": {
      "type": "openai-compatible",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "sk-or-..."
    }
  }
}
```

Once configured, you route requests to a specific provider using the `provider/model` alias syntax (e.g., `openrouter/gpt-4o`). See [Model Resolution, Aliasing, and Normalization](16-model-resolution-aliasing-and-normalization) for details.

Sources: [src/lib/config.ts](src/lib/config.ts#L564-L574), [src/lib/provider-model.ts](src/lib/provider-model.ts#L8-L26)

---

## Model Configuration

Each provider can define per-model settings via the `models` sub-object. These settings override defaults when that model is used through that provider.

### ModelConfig Fields

| Field | Type | Description |
|---|---|---|
| `temperature` | `number` | Sampling temperature for the model |
| `topP` | `number` | Nucleus sampling parameter |
| `topK` | `number` | Top-K sampling parameter |
| `extraBody` | `Record<string, unknown>` | Additional key-value pairs merged into the request body |
| `contextCache` | `boolean` | Enable context caching for the model |
| `supportPdf` | `boolean` | Whether the model supports PDF input |
| `toolContentSupportType` | `Array<string>` | Supported tool content types: `"array"`, `"image"`, `"pdf"` |

Sources: [src/lib/config.ts](src/lib/config.ts#L36-L44)

### Example: Model-Specific Settings

```json
{
  "providers": {
    "my-provider": {
      "type": "openai-compatible",
      "baseUrl": "https://api.example.com",
      "apiKey": "sk-...",
      "models": {
        "gpt-4o": {
          "temperature": 0.7,
          "extraBody": { "service_tier": "priority" }
        },
        "claude-sonnet-4-20250514": {
          "contextCache": true,
          "supportPdf": true,
          "toolContentSupportType": ["array", "image", "pdf"]
        }
      }
    }
  }
}
```

---

## Model Mappings (`modelMappings`)

A simple string-to-string map that transparently renames models at the API boundary. When a client requests model `"gpt-4o"` and the mapping contains `"gpt-4o": "gpt-4o-mini"`, the server silently substitutes the model name before forwarding to upstream.

```json
{
  "modelMappings": {
    "gpt-4o": "gpt-4o-mini",
    "claude-sonnet-4": "claude-sonnet-4-20250514"
  }
}
```

Model mappings can also be read and updated at runtime via the admin API:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/config/model-mappings` | Retrieve current mappings |
| `POST` | `/admin/config/model-mappings` | Replace all mappings (requires admin API key) |

Sources: [src/lib/config.ts](src/lib/config.ts#L362-L382), [src/routes/admin/config/route.ts](src/routes/admin/config/route.ts#L14-L48)

---

## Extra Prompts (`extraPrompts`)

A map of model name to string. When a request targets one of these models, the corresponding string is automatically appended to the system prompt. This is used to inject model-specific behavioral instructions.

The built-in defaults include exploration and commentary prompts for GPT-5 family models:

| Model | Prompt Purpose |
|---|---|
| `gpt-5-mini` | Exploration and batch file reading instructions |
| `gpt-5.3-codex` | Commentary channel communication instructions |
| `gpt-5.4-mini` | Commentary channel communication instructions |
| `gpt-5.4` | Commentary channel communication instructions |
| `gpt-5.5` | Commentary channel communication instructions |

You can override these or add your own entries. Missing default entries are automatically merged in at startup.

Sources: [src/lib/config.ts](src/lib/config.ts#L73-L117), [src/lib/config.ts](src/lib/config.ts#L229-L284)

---

## Reasoning Efforts (`modelReasoningEfforts`)

Controls the reasoning effort level applied per model. Valid values are:

| Level | Description |
|---|---|
| `"none"` | No reasoning |
| `"minimal"` | Minimal reasoning |
| `"low"` | Low reasoning effort |
| `"medium"` | Medium reasoning effort |
| `"high"` | High reasoning effort (default for unknown models) |
| `"xhigh"` | Maximum reasoning effort |

Default mappings:

| Model | Effort |
|---|---|
| `gpt-5-mini` | `"low"` |
| `gpt-5.3-codex` | `"xhigh"` |
| `gpt-5.4-mini` | `"xhigh"` |
| `gpt-5.4` | `"xhigh"` |
| `gpt-5.5` | `"xhigh"` |

Sources: [src/lib/config.ts](src/lib/config.ts#L120-L127), [src/lib/config.ts](src/lib/config.ts#L444-L449)

---

## Compact Thresholds (`modelResponsesApiCompactThresholds`)

When `useResponsesApiContextManagement` is `true`, the server monitors token usage during streaming. When a model's token count exceeds the threshold defined here, the server triggers automatic context compaction — summarizing the conversation to free up context space.

The threshold is specified as a token count. Default values:

| Model | Threshold | Calculation |
|---|---|---|
| `gpt-5.4` | `217,600` | 272,000 × 0.8 |
| `gpt-5.5` | `217,600` | 272,000 × 0.8 |

Sources: [src/lib/config.ts](src/lib/config.ts#L100-L103), [src/lib/config.ts](src/lib/config.ts#L427-L442)

---

## CLI Options

The server is started via the `copilot-api start` command. All options are optional and have sensible defaults.

### Global Options (apply to all subcommands)

These must be placed **before** the subcommand name.

| Flag | Type | Default | Description |
|---|---|---|---|
| `--api-home` | `string` | `~/.local/share/copilot-api` | Override the application data directory |
| `--oauth-app` | `string` | *(empty)* | OAuth application identifier (affects token storage path) |
| `--enterprise-url` | `string` | *(empty)* | Enterprise GitHub domain (e.g., `github.mycompany.com`) |

Sources: [src/main.ts](src/main.ts#L7-L20)

### `start` Subcommand Options

| Flag | Alias | Type | Default | Description |
|---|---|---|---|---|
| `--port` | `-p` | `string` | `"4141"` | TCP port to listen on |
| `--verbose` | `-v` | `boolean` | `false` | Enable verbose debug logging (consola level 5) |
| `--account-type` | `-a` | `string` | `"individual"` | GitHub account type: `"individual"`, `"business"`, or `"enterprise"` |
| `--manual` | — | `boolean` | `false` | Require manual terminal approval for each incoming request |
| `--rate-limit` | `-r` | `string` | *(disabled)* | Minimum seconds between forwarded requests |
| `--wait` | `-w` | `boolean` | `false` | When rate-limited, wait instead of returning HTTP 429. Ignored if `--rate-limit` is not set |
| `--github-token` | `-g` | `string` | *(auto)* | Provide a pre-generated GitHub token directly (must be from `auth` command) |
| `--claude-code` | `-c` | `boolean` | `false` | Interactive mode that generates a clipboard command for launching Claude Code |
| `--show-token` | — | `boolean` | `false` | Print GitHub and Copilot tokens to the console on fetch and refresh |
| `--proxy-env` | — | `boolean` | `false` | Initialize HTTP/HTTPS proxy routing from standard environment variables |

Sources: [src/start.ts](src/start.ts#L160-L224)

### `auth` Subcommand Options

| Flag | Alias | Type | Default | Description |
|---|---|---|---|---|
| `--provider` | — | `string` | *(interactive prompt)* | Provider to authenticate: `"copilot"` or `"codex"` |
| `--verbose` | `-v` | `boolean` | `false` | Enable verbose debug logging |
| `--show-token` | — | `boolean` | `false` | Print the access token after authentication |

Sources: [src/auth.ts](src/auth.ts#L17-L33)

### Other Subcommands

| Subcommand | Description |
|---|---|
| `check-usage` | Display current GitHub Copilot usage and quota information |
| `debug` | Print runtime diagnostics (version, paths, providers, token status). Supports `--json` flag |
| `mcp` | Start the MCP tool_search bridge over stdio for Claude Code integration |

Sources: [src/check-usage.ts](src/check-usage.ts#L11-L13), [src/debug.ts](src/debug.ts#L129-L135), [src/mcp.ts](src/mcp.ts#L49-L52)

---

## Environment Variables

Environment variables provide an alternative configuration surface, primarily used for paths, integrations, and Docker deployments.

### Application Environment Variables

| Variable | Description | Default | Source |
|---|---|---|---|
| `COPILOT_API_HOME` | Override the application data directory | `~/.local/share/copilot-api` | [src/lib/paths.ts](src/lib/paths.ts#L9) |
| `COPILOT_API_OAUTH_APP` | OAuth app identifier — affects token file naming and API behavior | *(empty)* | [src/lib/paths.ts](src/lib/paths.ts#L5) |
| `COPILOT_API_ENTERPRISE_URL` | Enterprise GitHub domain — switches all GitHub API calls to enterprise endpoints | *(empty)* | [src/lib/api-config.ts](src/lib/api-config.ts#L22-L26) |
| `ANTHROPIC_API_KEY` | Fallback Anthropic API key (used when `anthropicApiKey` is not in config) | *(none)* | [src/lib/config.ts](src/lib/config.ts#L628-L631) |
| `GH_TOKEN` | GitHub token (used by the Docker entrypoint to pass `-g` flag) | *(none)* | [entrypoint.sh](entrypoint.sh#L7) |

### Runtime / Development Environment Variables

| Variable | Description | Used In |
|---|---|---|
| `NODE_USE_SYSTEM_CA` | Enable system CA certificate bundle (set to `1` in dev/start scripts) | [package.json](package.json#L31) |
| `NODE_ENV` | Set to `production` in the start script | [package.json](package.json#L38) |

### Proxy Environment Variables (when `--proxy-env` is active)

When the `--proxy-env` flag is passed to `start`, the server reads standard proxy environment variables and routes all outgoing HTTP requests accordingly:

| Variable | Description |
|---|---|
| `HTTP_PROXY` | Proxy URL for HTTP requests |
| `HTTPS_PROXY` | Proxy URL for HTTPS requests |
| `ALL_PROXY` | Proxy URL for all protocols |
| `NO_PROXY` | Comma-separated list of hosts to bypass |

Sources: [src/lib/proxy.ts](src/lib/proxy.ts#L11-L77)

---

## File System Layout

All persistent data is stored under the application directory (`$APP_DIR`). Here is the complete file layout:

```
$APP_DIR/                          # Default: ~/.local/share/copilot-api
├── config.json                    # Main configuration file (0o600)
├── codex_credentials.json         # Codex OAuth credentials (when using codex provider)
├── logs/                          # Rotated log files (7-day retention)
│   └── <handler>.log
└── [oauth-app]/                   # OAuth-app-scoped directory (when --oauth-app is set)
    └── [ent_]github_token         # GitHub access token (prefixed "ent_" for enterprise)
```

The `ent_` prefix is prepended to the token filename when `COPILOT_API_ENTERPRISE_URL` is set, allowing separate enterprise token storage.

Sources: [src/lib/paths.ts](src/lib/paths.ts#L1-L40), [src/lib/logger.ts](src/lib/logger.ts#L11-L14)

---

## Desktop Application Settings

When running the Electron desktop application, an additional settings file is used for GUI-specific preferences. This is separate from the server `config.json`.

| Property | Value |
|---|---|
| **Path** | `~/.local/share/copilot-api/desktop-config.json` |
| **Managed by** | Electron settings store |

### Desktop Settings Fields

| Key | Type | Default | Description |
|---|---|---|---|
| `apiHome` | `string` | `""` | Custom API home directory |
| `oauthApp` | `string` | `"default"` | OAuth app: `"default"` or `"opencode"` |
| `enterpriseUrl` | `string` | `""` | Enterprise GitHub URL |
| `lastPort` | `number` | `4141` | Last used server port |
| `minimizeToTray` | `boolean` | `false` | Minimize to system tray on close |
| `accountType` | `string` | `"individual"` | Account type: `"individual"`, `"business"`, `"enterprise"` |
| `verbose` | `boolean` | `false` | Verbose logging |
| `showToken` | `boolean` | `false` | Show tokens in logs |
| `language` | `string` | `"auto"` | UI language: `"en"`, `"zh"`, `"auto"` |
| `proxy` | `object` | *(see below)* | Proxy configuration |

### Desktop Proxy Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `proxy.mode` | `string` | `"system"` | Proxy mode: `"system"`, `"custom"`, `"direct"` |
| `proxy.http_proxy` | `string` | `"http://127.0.0.1:8888"` | Custom HTTP proxy URL |
| `proxy.https_proxy` | `string` | `"http://127.0.0.1:8888"` | Custom HTTPS proxy URL |
| `proxy.no_proxy` | `string` | `"localhost,127.0.0.1"` | Proxy bypass list |

Sources: [desktop/electron/settings-store.ts](desktop/electron/settings-store.ts#L8-L32)

---

## Docker-Specific Configuration

When running in Docker, configuration is passed through environment variables and the entrypoint script.

| Environment Variable | Purpose | Example |
|---|---|---|
| `GH_TOKEN` | GitHub token for authentication (passed to `-g` flag) | `ghp_xxxxxxxxxxxx` |

The Docker image exposes port **4141** by default and includes a health check that pings the root endpoint every 30 seconds. The entrypoint script supports two modes:

- **Default mode** (`docker run ...`): Runs `copilot-api start -g "$GH_TOKEN"` with any additional arguments passed through.
- **Auth mode** (`docker run ... --auth`): Runs `copilot-api auth` for token generation.

For the complete Docker deployment guide, see [Docker Deployment](5-docker-deployment).

Sources: [Dockerfile](Dockerfile#L1-L27), [entrypoint.sh](entrypoint.sh#L1-L9)

---

## Configuration Merge Behavior

At startup, the application performs a multi-step merge:

1. **Read** the config file from disk (or create it with defaults if absent)
2. **Merge defaults** — any missing `extraPrompts`, `modelResponsesApiCompactThresholds`, or `modelReasoningEfforts` entries from the built-in defaults are added
3. **Ensure admin API key** — if `auth.adminApiKey` is missing or empty, a random 64-hex-char key is generated and persisted
4. **Persist** — if any changes were made during merging, the updated config is written back to disk

This ensures that config files created by older versions are automatically upgraded with new defaults, and that the admin API key is always present.

The `reloadConfig()` function can be called at runtime to re-read and re-merge the config file, which is used by the admin API when model mappings are updated.

Sources: [src/lib/config.ts](src/lib/config.ts#L320-L355)

---

## Debugging Configuration

The `copilot-api debug` command provides a quick diagnostic view of the running configuration:

```bash
# Human-readable output
copilot-api debug

# JSON output (for scripting)
copilot-api debug --json
```

This prints:
- Application version
- Runtime (Bun or Node.js, version, platform, architecture)
- Enabled providers and whether Codex is configured
- Resolved file paths (`APP_DIR`, `CONFIG_PATH`, `GITHUB_TOKEN_PATH`)
- Whether a GitHub token file exists

Sources: [src/debug.ts](src/debug.ts#L75-L95)

---

## Next Steps

- [Quick Start](2-quick-start) — Get the server running in under 2 minutes
- [CLI Commands and Global Options](3-cli-commands-and-global-options) — Full CLI reference with examples
- [Docker Deployment](5-docker-deployment) — Container-based deployment guide
- [Third-Party Provider Configuration and Proxying](15-third-party-provider-configuration-and-proxying) — Deep dive into provider setup
- [Model Resolution, Aliasing, and Normalization](16-model-resolution-aliasing-and-normalization) — How model names are resolved and remapped