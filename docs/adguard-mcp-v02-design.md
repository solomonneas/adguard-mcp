# adguard-mcp v0.2 Design - check_host + client CRUD + global services + toggles + destructive trio

Extends v0.1.1 with 13 tools that close the gap between "I can read AGH and edit user rules" and "I can drive AGH end-to-end". 15 -> 28 tools after this ships.

## What's added

### Tier 1 reads (4)

| Tool | Description | AGH endpoint |
|---|---|---|
| `adguard_check_host` | Test what AGH would do with a hostname (filter/safesearch/safebrowsing decision, matched rules, CNAME chain) | `GET /control/filtering/check_host?name=<host>[&client=<c>][&qtype=<type>]` |
| `adguard_get_blocked_services` | Global blocked services list + schedule (vs. v0.1.1's catalog read) | `GET /control/blocked_services/get` |
| `adguard_get_dns_config` | DNS upstreams, cache, parallel resolution, bootstrap servers | `GET /control/dns_info` |
| `adguard_get_safesearch_settings` | SafeSearch enabled state + per-engine flags (bing/duckduckgo/google/yandex/youtube/etc) | `GET /control/safesearch/status` |

### Tier 2 safe-writes (6)

| Tool | Description | AGH endpoint |
|---|---|---|
| `adguard_refresh_filter_lists` | Force refresh subscribed filter lists immediately | `POST /control/filtering/refresh` body `{whitelist: bool}` |
| `adguard_add_client` | Register a new named client (IP/MAC/ClientID + per-client settings) | `POST /control/clients/add` body `Client` |
| `adguard_update_client` | Full update for an existing named client | `POST /control/clients/update` body `{name, data: Client}` |
| `adguard_set_blocked_services` | Set GLOBAL blocked services + optional weekly schedule | `PUT /control/blocked_services/update` body `BlockedServicesSchedule` |
| `adguard_toggle_safesearch` | Enable/disable SafeSearch globally (per-engine flags optional) | `PUT /control/safesearch/settings` body `SafeSearchConfig` |
| `adguard_toggle_safebrowsing` | Enable/disable AGH safebrowsing | `POST /control/safebrowsing/enable` or `/disable` (split endpoints) |

### Tier 3 destructive (3)

| Tool | Description | AGH endpoint |
|---|---|---|
| `adguard_delete_client` | Remove a configured client by name | `POST /control/clients/delete` body `{name}` |
| `adguard_clear_query_log` | Wipe the DNS query log | `POST /control/querylog_clear` (no body) |
| `adguard_reset_stats` | Reset 24h stats (or whatever `stats.interval` is set to) | `POST /control/stats_reset` (no body) |

Total tool count after v0.2: 28 (was 15).

## Args + behavior

### `adguard_check_host`

Args:
- `host: string` (required) - hostname to test (e.g., `youtube.com`, `t.co`)
- `client?: string` - optional client IP/ID/name to simulate the lookup against (per-client rules differ)
- `qtype?: string` - DNS query type, default `A`. Common values: A, AAAA, HTTPS, MX
- `instance?: string` - which AGH instance

Behavior: `GET /control/filtering/check_host` with query params. Returns `{reason, rules[], service_name, cname, ip_addrs}`. Read-only; no gating beyond instance resolution.

### `adguard_get_blocked_services`

Args:
- `instance?: string`

Returns `{schedule: {time_zone, sun..sat: {start, end}}, ids: [...]}`. `schedule.<day>.start/end` are milliseconds-from-midnight (NOT HH:MM strings - the client converts for readability if requested).

### `adguard_get_dns_config`

Args: `instance?: string`

Returns the full `DNSConfig` schema (upstream_dns, bootstrap_dns, local_ptr_upstreams, ratelimit, blocking_mode, etc) plus `default_local_ptr_upstreams`. Read-only.

### `adguard_get_safesearch_settings`

Args: `instance?: string`

Returns `{enabled, bing, duckduckgo, ecosia, google, pixabay, yandex, youtube}`.

### `adguard_refresh_filter_lists`

Args:
- `whitelist?: boolean` (default `false`) - refresh the allowlist lists instead of the blocklist lists
- `confirm: boolean` (required, must be `true`)
- `instance?: string`

Behavior: `POST /control/filtering/refresh` body `{whitelist}`. Returns `{updated: count}`. Tier 2 because it triggers external HTTP fetches and CPU spend, even though it doesn't change persistent state.

### `adguard_add_client`

Args (matches AGH `Client` schema):
- `name: string` (required)
- `ids: string[]` (required) - IPs/MACs/ClientIDs/CIDRs (at least one)
- `use_global_settings?: boolean` (default `true`)
- `filtering_enabled?: boolean`
- `safebrowsing_enabled?: boolean`
- `parental_enabled?: boolean`
- `safe_search?: SafeSearchConfig` - per-engine flags
- `use_global_blocked_services?: boolean` (default `true`)
- `blocked_services?: string[]`
- `blocked_services_schedule?: Schedule`
- `upstreams?: string[]`
- `tags?: string[]`
- `ignore_querylog?: boolean`
- `ignore_statistics?: boolean`
- `upstreams_cache_enabled?: boolean`
- `upstreams_cache_size?: number`
- `confirm: boolean` (required, must be `true`)
- `instance?: string`

Behavior: `POST /control/clients/add` with the Client body. 200 empty on success. 400 if `name` already exists.

### `adguard_update_client`

Args:
- `name: string` (required) - current name of the client to update
- `data: Client` (required) - full new Client object (NOT a partial merge; AGH replaces the whole record)
- `confirm: boolean` (required, must be `true`)
- `instance?: string`

Behavior: `POST /control/clients/update` body `{name, data}`. Note the nested shape - the body is NOT flat. If the client wants to rename, they set `name` to the OLD name and `data.name` to the NEW name.

### `adguard_set_blocked_services`

Args:
- `ids: string[]` (required) - service ids from the catalog (youtube, instagram, ...). Empty array clears global blocks
- `schedule?: {time_zone, sun..sat: {start, end}}` - optional weekly schedule. start/end are milliseconds-from-midnight (max `86400000`). Tool accepts both raw ms and `"HH:MM"` strings; converts strings to ms before sending
- `confirm: boolean` (required, must be `true`)
- `instance?: string`

Behavior: `PUT /control/blocked_services/update` body `BlockedServicesSchedule`. Note PUT, not POST.

### `adguard_toggle_safesearch`

Args:
- `enabled: boolean` (required)
- `bing?: boolean`, `duckduckgo?: boolean`, `ecosia?: boolean`, `google?: boolean`, `pixabay?: boolean`, `yandex?: boolean`, `youtube?: boolean` - per-engine flags (only meaningful when `enabled: true`)
- `confirm: boolean` (required, must be `true`)
- `instance?: string`

Behavior: `PUT /control/safesearch/settings` with full `SafeSearchConfig`. When per-engine flags are omitted and `enabled: true`, defaults to all engines `true`. When `enabled: false`, per-engine flags are sent as `false`.

### `adguard_toggle_safebrowsing`

Args:
- `enabled: boolean` (required)
- `confirm: boolean` (required, must be `true`)
- `instance?: string`

Behavior: Picks `POST /control/safebrowsing/enable` or `/disable` based on `enabled`. No body. 200 empty.

### `adguard_delete_client`

Args:
- `name: string` (required)
- `confirm: boolean` (required, must be `true`)
- `destructive: boolean` (required, must be `true`)
- `instance?: string`

Behavior: `POST /control/clients/delete` body `{name}`. 200 empty. Tier 3 because per-client rules + per-client query log routing are gone after this.

### `adguard_clear_query_log`

Args:
- `confirm: boolean` (required, must be `true`)
- `destructive: boolean` (required, must be `true`)
- `instance?: string`

Behavior: `POST /control/querylog_clear` (underscore, not slash). No body. 200 empty. Wipes the in-memory + on-disk query log. Tier 3 because the data is gone forever.

### `adguard_reset_stats`

Args:
- `confirm: boolean` (required, must be `true`)
- `destructive: boolean` (required, must be `true`)
- `instance?: string`

Behavior: `POST /control/stats_reset` (underscore). No body. 200 empty. Zeroes the full stats window (`stats.interval`).

## Client additions

`AdGuardClient` already has `get`/`post`. Add `put(path, body?)` for `blocked_services/update` and `safesearch/settings`. Mirror the same `request<T>("PUT", path, body)` pattern proxmox-client + librenms-client use.

```typescript
async put<T = unknown>(path: string, body?: unknown): Promise<T> {
  return this.request<T>("PUT", path, body);
}
```

Add a `put` test asserting the right HTTP verb is emitted.

## Schedule helper

`adguard_set_blocked_services` and `adguard_add_client`/`update_client` (when `blocked_services_schedule` is set) accept `"HH:MM"` strings for convenience. The client-side helper converts:

```typescript
function hhmmToMs(value: string | number): number {
  if (typeof value === "number") return value;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new ConfigError(`schedule time must be HH:MM or milliseconds, got: ${value}`);
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 24 || mm > 59) throw new ConfigError(`invalid HH:MM: ${value}`);
  return (h * 60 + mm) * 60 * 1000;
}
```

Helper lives in `src/tools/_util.ts` next to `InstanceArg`. Tests cover edge cases (24:00 -> 86400000, mid-day values, invalid input).

## Tier 3 gating

Mirrors the established v0.1.1 pattern: `assertDestructive(args, toolName)` already exists. Each tier-3 tool calls it at the top. No new env-flag gate (AGH destructive ops are bounded - they wipe per-instance data, not infrastructure - so the `confirm: true` + `destructive: true` arg pair is sufficient).

## Tests

- 13 new per-tool tests, ~2 tests each = ~26 new tests
- 1 client PUT method test
- 4 schedule-converter helper tests (ms passthrough, HH:MM convert, 24:00 edge, invalid input)
- 3 gating tests (refresh requires confirm; toggle_safesearch requires confirm; delete_client requires confirm + destructive)
- Integration smoke updated to assert 28 tools register

Target: ~75 tests total (~40 from v0.1.1 + ~35 new).

## Operator follow-up (build-but-don't-flip)

PR ships code + tests + bumped version. Operator owns:

1. **No new env vars** - existing per-instance basic-auth credentials cover everything in v0.2. AGH itself doesn't differentiate read vs. write at the auth layer (basic-auth gives full control), so the safety boundary stays at the MCP gate.
2. **Smoke after merge:** `adguard_check_host` against `youtube.com` (read, no gate) -> `adguard_refresh_filter_lists` with `whitelist: false, confirm: true` (safe-write, gated) -> `adguard_clear_query_log` with `confirm: true, destructive: true` (destructive, double-gated). Reading then writing then destroying.

## Acceptance criteria

1. `npm test` ~75 tests green
2. All 28 tools register at startup
3. Each tier-2 tool rejects calls missing `confirm: true` with `WriteGateError`
4. Each tier-3 tool rejects calls missing `confirm: true` OR `destructive: true` with `WriteGateError`
5. `adguard_set_blocked_services` accepts BOTH `"HH:MM"` strings and millisecond integers for schedule times
6. `adguard_update_client` body is `{name, data}` (nested), NOT a flat client merge
7. `adguard_clear_query_log` POSTs to `/control/querylog_clear` (underscore), not `/control/querylog/clear`
8. `adguard_reset_stats` POSTs to `/control/stats_reset` (underscore), not `/control/stats/reset`
9. `adguard_set_blocked_services` PUTs (not POSTs) to `/control/blocked_services/update`
10. README + design doc updated with v0.2 tool list; profile README adguard-mcp line updated to "28 tools"

## Out of scope (deferred to v0.3+)

- DNS upstream config writes (`POST /control/dns_config`) - DNS config is sensitive; needs more thought on safety
- DHCP server management
- DNS rewrites (custom A/CNAME records)
- TLS / cert management
- Per-client query log routing audit (`access/list` + `access/set`)
- `version.json` upstream-update check (rarely useful agent surface)
- `test_upstream_dns` diagnostic
- Tag-based bulk client operations (still rare in practice)

## Notes / gotchas captured from API verification

- Base path is `/control`, every path above is prefixed.
- `blocked_services/update` is `PUT`, not `POST`. The only PUT in this batch alongside `safesearch/settings`.
- `querylog_clear` and `stats_reset` use underscores. AGH is inconsistent about underscore-vs-slash in paths; older endpoints favor slashes, newer favor underscores. Verify in the OpenAPI before adding any future endpoint.
- `ClientUpdate` is nested `{name, data}`, NOT a flat merge - if a caller forgets the wrap, AGH returns a confusing 400.
- `Schedule.DayRange.start/end` are milliseconds-from-midnight, not HH:MM strings. The helper converts at the boundary.
- `POST /control/safesearch/enable` and `/disable` still exist but are deprecated. Use `PUT /control/safesearch/settings`.
- `POST /control/blocked_services/set` and `GET /control/blocked_services/list` are deprecated. Use `PUT /control/blocked_services/update` and `GET /control/blocked_services/get`.
