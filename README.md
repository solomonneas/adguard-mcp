# adguard-mcp

MCP server exposing AdGuard Home read/write tools across one or more instances. Three-tier write gating: reads are open, writes require `confirm: true`, destructive ops require `confirm: true` + `destructive: true`.

## Tools

**Reads (7):** `adguard_status`, `adguard_stats`, `adguard_query_log`, `adguard_list_filter_lists`, `adguard_list_user_rules`, `adguard_list_clients`, `adguard_list_blocked_services_catalog`.

**Safe writes (6, require `confirm: true`):** `adguard_add_user_rule`, `adguard_remove_user_rule`, `adguard_add_filter_list`, `adguard_remove_filter_list`, `adguard_toggle_filter_list`, `adguard_set_client_blocked_services`.

**Destructive (2, require `confirm: true` + `destructive: true`):** `adguard_replace_user_rules`, `adguard_toggle_protection`.

## Configuration

Set per-instance env vars. At least one instance is required.

```
ADGUARD_PRIMARY_URL=http://192.168.1.10
ADGUARD_PRIMARY_USERNAME=admin
ADGUARD_PRIMARY_PASSWORD=<password>

# Optional second instance:
ADGUARD_SECONDARY_URL=http://192.168.1.11
ADGUARD_SECONDARY_USERNAME=admin
ADGUARD_SECONDARY_PASSWORD=<password>

# Optional: which instance is default when a tool omits the `instance` arg:
ADGUARD_DEFAULT_INSTANCE=primary
```

Instance names are derived from the env-var middle segment (case-insensitive). Add `ADGUARD_LIVINGROOM_URL/USERNAME/PASSWORD` and the MCP picks it up on next start.

Every tool accepts optional `instance: "<name>"` to address a non-default box.

## Install

```
npm install -g @solomonneas/adguard-mcp
```

Or run via npx:

```
npx -y @solomonneas/adguard-mcp
```

## Setup

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "adguard": {
      "command": "npx",
      "args": ["-y", "@solomonneas/adguard-mcp"],
      "env": {
        "ADGUARD_PRIMARY_URL": "http://192.168.1.10",
        "ADGUARD_PRIMARY_USERNAME": "admin",
        "ADGUARD_PRIMARY_PASSWORD": "your-password"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add adguard -s user -- npx -y @solomonneas/adguard-mcp
```

Then export env vars in your shell (`~/.bashrc`, `~/.zshrc`) or pass `--env` flags.

### OpenClaw

Plugin loads automatically once installed. Config goes in your `~/.openclaw/openclaw.json` `plugins.entries.adguard` (or use the bundled `openclaw.plugin.json`):

```json
{
  "plugins": {
    "entries": {
      "adguard": {
        "package": "@solomonneas/adguard-mcp",
        "activation": { "onStartup": true }
      }
    }
  }
}
```

Env vars from `~/.openclaw/workspace/.env` are inherited by the plugin.

### Hermes Agent

Add to `~/.config/hermes/agents.yaml`:

```yaml
mcp_servers:
  adguard:
    command: npx
    args: ["-y", "@solomonneas/adguard-mcp"]
    env:
      ADGUARD_PRIMARY_URL: http://192.168.1.10
      ADGUARD_PRIMARY_USERNAME: admin
      ADGUARD_PRIMARY_PASSWORD: your-password
```

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.adguard]
command = "npx"
args = ["-y", "@solomonneas/adguard-mcp"]

[mcp_servers.adguard.env]
ADGUARD_PRIMARY_URL = "http://192.168.1.10"
ADGUARD_PRIMARY_USERNAME = "admin"
ADGUARD_PRIMARY_PASSWORD = "your-password"
```

## Safety

- Credentials only live in memory after env-load and are redacted from logs and error messages.
- Tier 2 writes require an explicit `confirm: true` arg; the JSON schema documents this on every write tool.
- Tier 3 destructive ops additionally require `destructive: true`. The model cannot disable protection or overwrite the rules block from a hallucinated tool call.

## License

MIT
