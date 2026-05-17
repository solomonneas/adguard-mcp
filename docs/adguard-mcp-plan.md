# adguard-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (implementer-only flow, opus-4-7). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `solomonneas/adguard-mcp` v0.1.0 - a TypeScript MCP server exposing 15 tools across read/safe-write/destructive tiers for one or more AdGuard Home instances. Dual publish to npm + ClawHub. README documents all 5 clients.

**Architecture:** Mirrors `solomonneas/postiz-mcp` (latest published MCP template). TypeScript + `@modelcontextprotocol/sdk` 1.29 + TypeBox schemas + vitest tests + tsup bundler. Each tool is `createXxxTool(getClient: () => AdGuardClient)` returning `{name, label, description, parameters, execute}`. Plugin entry uses `definePluginEntry` from `openclaw/plugin-sdk/plugin-entry`. Multi-instance via per-name `ADGUARD_<INSTANCE>_URL/USERNAME/PASSWORD` env vars; tool calls accept optional `instance` arg.

**Tech Stack:** TypeScript 6, `@modelcontextprotocol/sdk` ^1.29, `@sinclair/typebox` ^0.34, `vitest` ^4, `tsup` ^8, `tsx` ^4, `openclaw` ^2026.4.22 (devDep, plugin-sdk types).

---

## File Structure

**Create:**
- `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
- `src/config.ts` - resolve `ADGUARD_<NAME>_*` env into instance map
- `src/adguard-client.ts` - HTTP basic-auth client, per-instance
- `src/security.ts` - credential redaction
- `src/gates.ts` - `assertConfirmedWrite`, `assertDestructive`
- `src/tools/_util.ts` - `jsonToolResult`, `withInstance`
- `src/tools/<one-per-tool>.ts` (15 files)
- `src/tools/index.ts` - re-export all `createXxxTool` factories
- `index.ts` - `definePluginEntry` entry
- `mcp-server.ts` - stdio MCP server entry
- `openclaw.plugin.json` - OpenClaw plugin manifest
- `tests/fake-adguard.ts` - in-process AGH fake server
- `tests/tools/<tool>.test.ts` (15)
- `tests/config.test.ts`, `tests/gates.test.ts`, `tests/security.test.ts`, `tests/client.test.ts`
- `tests/integration.test.ts` - full server smoke
- `README.md` - 5-client setup
- `scripts/dev.sh` - convenience dev runner
- `.gitignore` (already created)

---

## Phase 1: Scaffolding

### Task 1: package.json + build config

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@solomonneas/adguard-mcp",
  "version": "0.1.0",
  "description": "MCP server exposing AdGuard Home read + write tools across one or more instances",
  "type": "module",
  "bin": {
    "adguard-mcp": "./dist/mcp-server.js"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsup",
    "start": "node dist/mcp-server.js",
    "dev": "tsx mcp-server.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run typecheck && npm test && npm run build"
  },
  "files": ["dist", "openclaw.plugin.json", "README.md", "LICENSE"],
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@sinclair/typebox": "^0.34.0"
  },
  "devDependencies": {
    "@types/node": "^25.6.2",
    "openclaw": "^2026.4.22",
    "tsup": "^8.4.0",
    "tsx": "^4.19.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.5"
  },
  "engines": { "node": ">=20" },
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/solomonneas/adguard-mcp" }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "lib": ["ES2022"]
  },
  "include": ["index.ts", "mcp-server.ts", "src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Write tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "mcp-server": "mcp-server.ts", "index": "index.ts" },
  format: ["esm"],
  target: "node20",
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
});
```

- [ ] **Step 4: Write vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 10000,
  },
});
```

- [ ] **Step 5: Install + commit**

```bash
cd ~/repos/adguard-mcp && npm install 2>&1 | tail -3
git add package.json package-lock.json tsconfig.json tsup.config.ts vitest.config.ts
git commit -m "chore: scaffold package + build config"
```

---

### Task 2: src/config.ts + tests

**Files:**
- Create: `src/config.ts`, `tests/config.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/config.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveInstances, getInstanceConfig, UnknownInstanceError, NoInstancesError } from "../src/config.ts";

describe("resolveInstances", () => {
  it("parses a single primary instance", () => {
    const env = {
      ADGUARD_PRIMARY_URL: "http://192.0.2.60",
      ADGUARD_PRIMARY_USERNAME: "example-user",
      ADGUARD_PRIMARY_PASSWORD: "secret",
    };
    const cfg = resolveInstances(env);
    expect(cfg.instances.primary).toEqual({
      url: "http://192.0.2.60",
      username: "example-user",
      password: "secret",
    });
    expect(cfg.defaultInstance).toBe("primary");
  });

  it("parses multiple instances", () => {
    const env = {
      ADGUARD_PRIMARY_URL: "http://192.0.2.60",
      ADGUARD_PRIMARY_USERNAME: "u1",
      ADGUARD_PRIMARY_PASSWORD: "p1",
      ADGUARD_SECONDARY_URL: "http://192.0.2.62",
      ADGUARD_SECONDARY_USERNAME: "u2",
      ADGUARD_SECONDARY_PASSWORD: "p2",
    };
    const cfg = resolveInstances(env);
    expect(Object.keys(cfg.instances).sort()).toEqual(["primary", "secondary"]);
  });

  it("respects ADGUARD_DEFAULT_INSTANCE", () => {
    const env = {
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      ADGUARD_PRIMARY_PASSWORD: "p",
      ADGUARD_SECONDARY_URL: "http://y",
      ADGUARD_SECONDARY_USERNAME: "u",
      ADGUARD_SECONDARY_PASSWORD: "p",
      ADGUARD_DEFAULT_INSTANCE: "secondary",
    };
    expect(resolveInstances(env).defaultInstance).toBe("secondary");
  });

  it("throws NoInstancesError when no ADGUARD_*_URL is set", () => {
    expect(() => resolveInstances({})).toThrow(NoInstancesError);
  });

  it("skips partial instances missing url/username/password", () => {
    const env = {
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      // missing password
      ADGUARD_SECONDARY_URL: "http://y",
      ADGUARD_SECONDARY_USERNAME: "u",
      ADGUARD_SECONDARY_PASSWORD: "p",
    };
    const cfg = resolveInstances(env);
    expect(Object.keys(cfg.instances)).toEqual(["secondary"]);
  });
});

describe("getInstanceConfig", () => {
  it("resolves a named instance", () => {
    const cfg = resolveInstances({
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      ADGUARD_PRIMARY_PASSWORD: "p",
    });
    expect(getInstanceConfig(cfg, "primary").url).toBe("http://x");
  });

  it("falls back to default when name omitted", () => {
    const cfg = resolveInstances({
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      ADGUARD_PRIMARY_PASSWORD: "p",
    });
    expect(getInstanceConfig(cfg).url).toBe("http://x");
  });

  it("throws UnknownInstanceError on bad name", () => {
    const cfg = resolveInstances({
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      ADGUARD_PRIMARY_PASSWORD: "p",
    });
    expect(() => getInstanceConfig(cfg, "tertiary")).toThrow(UnknownInstanceError);
  });
});
```

- [ ] **Step 2: Run red**

```bash
cd ~/repos/adguard-mcp && npx vitest run tests/config.test.ts 2>&1 | tail -10
```

Expected: module-not-found errors.

- [ ] **Step 3: Implement src/config.ts**

```typescript
export interface InstanceConfig {
  url: string;
  username: string;
  password: string;
}

export interface ResolvedConfig {
  instances: Record<string, InstanceConfig>;
  defaultInstance: string;
}

export class NoInstancesError extends Error {
  constructor() {
    super("No AdGuard instances configured. Set ADGUARD_<NAME>_URL/USERNAME/PASSWORD for at least one instance.");
    this.name = "NoInstancesError";
  }
}

export class UnknownInstanceError extends Error {
  constructor(name: string, known: string[]) {
    super(`Unknown AdGuard instance: ${name}. Known: ${known.join(", ") || "(none)"}.`);
    this.name = "UnknownInstanceError";
  }
}

const URL_RE = /^ADGUARD_([A-Z0-9_]+)_URL$/;

export function resolveInstances(env: Record<string, string | undefined>): ResolvedConfig {
  const instances: Record<string, InstanceConfig> = {};
  for (const key of Object.keys(env)) {
    const m = URL_RE.exec(key);
    if (!m) continue;
    const upperName = m[1];
    const name = upperName.toLowerCase();
    const url = env[`ADGUARD_${upperName}_URL`];
    const username = env[`ADGUARD_${upperName}_USERNAME`];
    const password = env[`ADGUARD_${upperName}_PASSWORD`];
    if (!url || !username || !password) continue;
    instances[name] = { url, username, password };
  }
  if (Object.keys(instances).length === 0) throw new NoInstancesError();
  const explicitDefault = env.ADGUARD_DEFAULT_INSTANCE?.toLowerCase();
  const defaultInstance = explicitDefault && instances[explicitDefault]
    ? explicitDefault
    : (instances.primary ? "primary" : Object.keys(instances).sort()[0]);
  return { instances, defaultInstance };
}

export function getInstanceConfig(cfg: ResolvedConfig, name?: string): InstanceConfig {
  const resolved = (name ?? cfg.defaultInstance).toLowerCase();
  const inst = cfg.instances[resolved];
  if (!inst) throw new UnknownInstanceError(resolved, Object.keys(cfg.instances));
  return inst;
}
```

- [ ] **Step 4: Run green**

```bash
npx vitest run tests/config.test.ts 2>&1 | tail -10
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat(config): multi-instance env resolver"
```

---

### Task 3: src/adguard-client.ts + fake-server pattern

**Files:**
- Create: `src/adguard-client.ts`, `tests/fake-adguard.ts`, `tests/client.test.ts`

- [ ] **Step 1: Write fake server helper**

`tests/fake-adguard.ts`:

```typescript
import { createServer, Server, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";

export interface CapturedRequest {
  method: string;
  path: string;
  authHeader: string | null;
  body: string;
}

export interface FakeRoute {
  method: string;
  path: string;
  status: number;
  body: unknown;
}

export interface FakeAdGuard {
  baseUrl: string;
  requests: CapturedRequest[];
  routes: FakeRoute[];
  reset(): void;
  close(): Promise<void>;
}

export async function startFakeAdGuard(routes: FakeRoute[] = []): Promise<FakeAdGuard> {
  const fake: FakeAdGuard = {
    baseUrl: "",
    requests: [],
    routes: [...routes],
    reset() { fake.requests.length = 0; fake.routes.length = 0; },
    close: () => Promise.resolve(),
  };
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      fake.requests.push({
        method: req.method ?? "GET",
        path: req.url ?? "/",
        authHeader: req.headers.authorization ?? null,
        body,
      });
      const route = fake.routes.find((r) => r.method === req.method && r.path === req.url);
      if (!route) {
        res.statusCode = 404;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ message: `no fake route for ${req.method} ${req.url}` }));
        return;
      }
      res.statusCode = route.status;
      res.setHeader("content-type", "application/json");
      res.end(typeof route.body === "string" ? route.body : JSON.stringify(route.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as AddressInfo).port;
  fake.baseUrl = `http://127.0.0.1:${port}`;
  fake.close = () => new Promise<void>((r) => server.close(() => r()));
  return fake;
}
```

- [ ] **Step 2: Write failing client tests**

`tests/client.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "./fake-adguard.ts";
import { AdGuardClient, AdGuardClientError, AdGuardUnreachableError } from "../src/adguard-client.ts";

let fake: FakeAdGuard | null = null;

afterEach(async () => {
  if (fake) await fake.close();
  fake = null;
});

describe("AdGuardClient", () => {
  it("sends HTTP basic auth with configured creds", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/status", status: 200, body: { version: "v0.107.50", protection_enabled: true } },
    ]);
    const c = new AdGuardClient({ url: fake.baseUrl, username: "example-user", password: "hunter2" });
    const r = await c.get("/control/status");
    expect(r).toEqual({ version: "v0.107.50", protection_enabled: true });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0].authHeader).toBe("Basic " + Buffer.from("example-user:hunter2").toString("base64"));
  });

  it("throws AdGuardClientError on 4xx", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/status", status: 401, body: { message: "unauthorized" } },
    ]);
    const c = new AdGuardClient({ url: fake.baseUrl, username: "x", password: "y" });
    await expect(c.get("/control/status")).rejects.toThrow(AdGuardClientError);
  });

  it("retries once on 5xx then throws AdGuardUnreachableError", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/status", status: 502, body: { message: "bad gateway" } },
    ]);
    const c = new AdGuardClient({ url: fake.baseUrl, username: "x", password: "y" }, { retryDelayMs: 5 });
    await expect(c.get("/control/status")).rejects.toThrow(AdGuardUnreachableError);
    expect(fake.requests).toHaveLength(2);
  });

  it("posts JSON body", async () => {
    fake = await startFakeAdGuard([
      { method: "POST", path: "/control/filtering/set_rules", status: 200, body: {} },
    ]);
    const c = new AdGuardClient({ url: fake.baseUrl, username: "u", password: "p" });
    await c.post("/control/filtering/set_rules", { rules: ["||example.com^"] });
    expect(fake.requests[0].method).toBe("POST");
    expect(JSON.parse(fake.requests[0].body)).toEqual({ rules: ["||example.com^"] });
  });

  it("does not include the basic-auth header in thrown error messages", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/status", status: 401, body: { message: "unauthorized" } },
    ]);
    const c = new AdGuardClient({ url: fake.baseUrl, username: "example-user", password: "super-secret" });
    try {
      await c.get("/control/status");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("super-secret");
      expect(msg).not.toContain("example-user:super-secret");
    }
  });
});
```

- [ ] **Step 3: Implement src/adguard-client.ts**

```typescript
export interface AdGuardClientOptions {
  retryDelayMs?: number;
}

export class AdGuardClientError extends Error {
  constructor(public status: number, message: string) {
    super(`AdGuard ${status}: ${message}`);
    this.name = "AdGuardClientError";
  }
}

export class AdGuardUnreachableError extends Error {
  constructor(cause: string) {
    super(`AdGuard unreachable: ${cause}`);
    this.name = "AdGuardUnreachableError";
  }
}

export interface ClientInstanceConfig {
  url: string;
  username: string;
  password: string;
}

export class AdGuardClient {
  private authHeader: string;
  private retryDelayMs: number;

  constructor(private cfg: ClientInstanceConfig, opts: AdGuardClientOptions = {}) {
    this.authHeader = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
    this.retryDelayMs = opts.retryDelayMs ?? 1000;
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = this.cfg.url.replace(/\/+$/, "") + path;
    const headers: Record<string, string> = { authorization: this.authHeader };
    let bodyStr: string | undefined;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      bodyStr = JSON.stringify(body);
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { method, headers, body: bodyStr });
        if (res.status >= 200 && res.status < 300) {
          const text = await res.text();
          return text ? (JSON.parse(text) as T) : (undefined as T);
        }
        if (res.status >= 500) {
          lastErr = new AdGuardUnreachableError(`HTTP ${res.status}`);
          if (attempt === 0) await sleep(this.retryDelayMs);
          continue;
        }
        const errText = await res.text();
        let msg = errText;
        try { msg = (JSON.parse(errText) as { message?: string }).message ?? errText; } catch {}
        throw new AdGuardClientError(res.status, msg);
      } catch (e) {
        if (e instanceof AdGuardClientError) throw e;
        lastErr = new AdGuardUnreachableError((e as Error).message);
        if (attempt === 0) await sleep(this.retryDelayMs);
      }
    }
    throw lastErr ?? new AdGuardUnreachableError("unknown");
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: Run green**

```bash
npx vitest run tests/client.test.ts 2>&1 | tail -10
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/adguard-client.ts tests/fake-adguard.ts tests/client.test.ts
git commit -m "feat(client): HTTP basic-auth client + fake-server test harness"
```

---

### Task 4: src/security.ts + tests

**Files:**
- Create: `src/security.ts`, `tests/security.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { redact, registerSecret } from "../src/security.ts";

describe("redact", () => {
  it("masks registered secrets in strings", () => {
    registerSecret("super-secret-password");
    expect(redact("authorization: Basic dXNlcjpzdXBlci1zZWNyZXQtcGFzc3dvcmQ=")).toContain("REDACTED");
    expect(redact("super-secret-password")).toBe("REDACTED");
  });

  it("walks objects deeply", () => {
    registerSecret("hidden-token");
    const result = redact({ headers: { authorization: "Bearer hidden-token" }, ok: true });
    expect(JSON.stringify(result)).not.toContain("hidden-token");
  });

  it("walks arrays", () => {
    registerSecret("array-secret");
    const result = redact([{ token: "array-secret" }, "ok"]);
    expect(JSON.stringify(result)).not.toContain("array-secret");
  });

  it("passes non-strings through unchanged", () => {
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(undefined);
  });

  it("does not mask the empty string", () => {
    registerSecret("");
    expect(redact("anything")).toBe("anything");
  });
});
```

- [ ] **Step 2: Implement src/security.ts**

```typescript
const SECRETS = new Set<string>();

export function registerSecret(s: string): void {
  if (s && s.length > 0) SECRETS.add(s);
}

export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    let out = value;
    for (const secret of SECRETS) out = out.split(secret).join("REDACTED");
    return out;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v);
    return out;
  }
  return value;
}

export function _resetForTests(): void {
  SECRETS.clear();
}
```

- [ ] **Step 3: Run green + commit**

```bash
npx vitest run tests/security.test.ts 2>&1 | tail -10
git add src/security.ts tests/security.test.ts
git commit -m "feat(security): credential redaction registry"
```

---

### Task 5: src/gates.ts + tests

**Files:**
- Create: `src/gates.ts`, `tests/gates.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { assertConfirmedWrite, assertDestructive, WriteGateError } from "../src/gates.ts";

describe("assertConfirmedWrite", () => {
  it("passes when confirm is true", () => {
    expect(() => assertConfirmedWrite({ confirm: true }, "adguard_add_user_rule")).not.toThrow();
  });
  it("throws when confirm is missing", () => {
    expect(() => assertConfirmedWrite({}, "adguard_add_user_rule")).toThrow(WriteGateError);
  });
  it("throws when confirm is false", () => {
    expect(() => assertConfirmedWrite({ confirm: false }, "adguard_add_user_rule")).toThrow(WriteGateError);
  });
  it("error message names the tool", () => {
    try { assertConfirmedWrite({}, "adguard_add_user_rule"); }
    catch (e) { expect((e as Error).message).toContain("adguard_add_user_rule"); }
  });
});

describe("assertDestructive", () => {
  it("passes when both confirm and destructive are true", () => {
    expect(() => assertDestructive({ confirm: true, destructive: true }, "adguard_replace_user_rules")).not.toThrow();
  });
  it("throws when destructive is missing", () => {
    expect(() => assertDestructive({ confirm: true }, "adguard_replace_user_rules")).toThrow(WriteGateError);
  });
  it("throws when confirm is missing", () => {
    expect(() => assertDestructive({ destructive: true }, "adguard_replace_user_rules")).toThrow(WriteGateError);
  });
});
```

- [ ] **Step 2: Implement src/gates.ts**

```typescript
export class WriteGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteGateError";
  }
}

export function assertConfirmedWrite(args: Record<string, unknown>, toolName: string): void {
  if (args.confirm !== true) {
    throw new WriteGateError(
      `${toolName} is a write operation. Pass {"confirm": true} to proceed.`,
    );
  }
}

export function assertDestructive(args: Record<string, unknown>, toolName: string): void {
  if (args.confirm !== true || args.destructive !== true) {
    throw new WriteGateError(
      `${toolName} is a destructive operation. Pass {"confirm": true, "destructive": true} to proceed.`,
    );
  }
}
```

- [ ] **Step 3: Run green + commit**

```bash
npx vitest run tests/gates.test.ts 2>&1 | tail -10
git add src/gates.ts tests/gates.test.ts
git commit -m "feat(gates): write-tier confirmation predicates"
```

---

## Phase 2: Tier 1 read tools

### Task 6: tool _util + adguard_status + adguard_stats

**Files:**
- Create: `src/tools/_util.ts`, `src/tools/adguard_status.ts`, `src/tools/adguard_stats.ts`, `tests/tools/status.test.ts`, `tests/tools/stats.test.ts`

- [ ] **Step 1: Write _util.ts**

```typescript
import { Type, Static } from "@sinclair/typebox";
import type { AdGuardClient } from "../adguard-client.ts";
import type { ResolvedConfig } from "../config.ts";
import { getInstanceConfig } from "../config.ts";

export const InstanceArg = Type.Optional(Type.String({
  description: "Named instance to target (e.g. 'primary', 'secondary'). Default: the configured default instance.",
}));

export type ClientFactory = (instance?: string) => AdGuardClient;

export function jsonToolResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function makeClientFactory(cfg: ResolvedConfig, build: (ic: ReturnType<typeof getInstanceConfig>) => AdGuardClient): ClientFactory {
  return (instance) => build(getInstanceConfig(cfg, instance));
}
```

- [ ] **Step 2: Write failing status + stats tests**

`tests/tools/status.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardStatusTool } from "../../src/tools/adguard_status.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_status", () => {
  it("returns the AGH status payload", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/status", status: 200,
        body: { version: "v0.107.50", protection_enabled: true, dns_port: 53, running: true } },
    ]);
    const tool = createAdguardStatusTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("test-id", {});
    const payload = JSON.parse(r.content[0].text);
    expect(payload.version).toBe("v0.107.50");
    expect(payload.protection_enabled).toBe(true);
  });
});
```

`tests/tools/stats.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardStatsTool } from "../../src/tools/adguard_stats.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_stats", () => {
  it("returns the AGH stats payload", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/stats", status: 200,
        body: { num_dns_queries: 1234, num_blocked_filtering: 200, top_blocked_domains: [], top_clients: [] } },
    ]);
    const tool = createAdguardStatsTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("test-id", {});
    const payload = JSON.parse(r.content[0].text);
    expect(payload.num_dns_queries).toBe(1234);
  });
});
```

- [ ] **Step 3: Implement src/tools/adguard_status.ts**

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });

export function createAdguardStatusTool(getClient: ClientFactory) {
  return {
    name: "adguard_status",
    label: "adguard: status",
    description: "Get the AdGuard Home server status (version, protection-enabled state, DNS port, running flag) via GET /control/status.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const status = await client.get("/control/status");
      return jsonToolResult(status);
    },
  };
}
```

- [ ] **Step 4: Implement src/tools/adguard_stats.ts**

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });

export function createAdguardStatsTool(getClient: ClientFactory) {
  return {
    name: "adguard_stats",
    label: "adguard: stats",
    description: "Get 24h DNS query statistics (totals, blocked %, top blocked domains, top clients) via GET /control/stats.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const stats = await client.get("/control/stats");
      return jsonToolResult(stats);
    },
  };
}
```

- [ ] **Step 5: Run green + commit**

```bash
npx vitest run tests/tools/status.test.ts tests/tools/stats.test.ts 2>&1 | tail -10
git add src/tools/_util.ts src/tools/adguard_status.ts src/tools/adguard_stats.ts tests/tools/status.test.ts tests/tools/stats.test.ts
git commit -m "feat(tools): adguard_status + adguard_stats (tier 1 read)"
```

---

### Task 7: adguard_query_log + adguard_list_blocked_services_catalog

**Files:**
- Create: `src/tools/adguard_query_log.ts`, `src/tools/adguard_list_blocked_services_catalog.ts`, `tests/tools/query_log.test.ts`, `tests/tools/blocked_services_catalog.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/tools/query_log.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardQueryLogTool } from "../../src/tools/adguard_query_log.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_query_log", () => {
  it("passes filter params as query string", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/querylog?limit=10&response_status=blocked", status: 200, body: { data: [] } },
    ]);
    const tool = createAdguardQueryLogTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    await tool.execute("id", { limit: 10, blocked_only: true });
    expect(fake.requests[0].path).toBe("/control/querylog?limit=10&response_status=blocked");
  });

  it("filters by client and domain", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/querylog?limit=50&search=192.168.1.5&domain=youtube.com", status: 200, body: { data: [] } },
    ]);
    const tool = createAdguardQueryLogTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    await tool.execute("id", { limit: 50, client: "192.168.1.5", domain: "youtube.com" });
    expect(fake.requests[0].path).toContain("search=192.168.1.5");
    expect(fake.requests[0].path).toContain("domain=youtube.com");
  });
});
```

`tests/tools/blocked_services_catalog.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardListBlockedServicesCatalogTool } from "../../src/tools/adguard_list_blocked_services_catalog.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_list_blocked_services_catalog", () => {
  it("returns the AGH services catalog", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/blocked_services/services", status: 200,
        body: { blocked_services: [{ id: "youtube", name: "YouTube" }, { id: "tiktok", name: "TikTok" }] } },
    ]);
    const tool = createAdguardListBlockedServicesCatalogTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", {});
    const payload = JSON.parse(r.content[0].text);
    expect(payload.blocked_services).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement query_log tool**

`src/tools/adguard_query_log.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, description: "Max entries to return. Default 50." })),
  client: Type.Optional(Type.String({ description: "Filter by client IP or hostname (AGH uses 'search')." })),
  domain: Type.Optional(Type.String({ description: "Filter by domain." })),
  blocked_only: Type.Optional(Type.Boolean({ description: "When true, only return blocked queries (AGH response_status=blocked)." })),
}, { additionalProperties: false });

export function createAdguardQueryLogTool(getClient: ClientFactory) {
  return {
    name: "adguard_query_log",
    label: "adguard: query log",
    description: "Read recent DNS queries via GET /control/querylog. Filter by client, domain, blocked-only.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string; limit?: number; client?: string; domain?: string; blocked_only?: boolean };
      const params = new URLSearchParams();
      params.set("limit", String(args.limit ?? 50));
      if (args.blocked_only) params.set("response_status", "blocked");
      if (args.client) params.set("search", args.client);
      if (args.domain) params.set("domain", args.domain);
      const client = getClient(args.instance);
      const log = await client.get(`/control/querylog?${params.toString()}`);
      return jsonToolResult(log);
    },
  };
}
```

- [ ] **Step 3: Implement catalog tool**

`src/tools/adguard_list_blocked_services_catalog.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });

export function createAdguardListBlockedServicesCatalogTool(getClient: ClientFactory) {
  return {
    name: "adguard_list_blocked_services_catalog",
    label: "adguard: blocked services catalog",
    description: "List the services AdGuard Home can block per-client (youtube, tiktok, instagram, etc) via GET /control/blocked_services/services.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const catalog = await client.get("/control/blocked_services/services");
      return jsonToolResult(catalog);
    },
  };
}
```

- [ ] **Step 4: Run green + commit**

```bash
npx vitest run tests/tools/query_log.test.ts tests/tools/blocked_services_catalog.test.ts 2>&1 | tail -10
git add src/tools/adguard_query_log.ts src/tools/adguard_list_blocked_services_catalog.ts tests/tools/query_log.test.ts tests/tools/blocked_services_catalog.test.ts
git commit -m "feat(tools): adguard_query_log + adguard_list_blocked_services_catalog"
```

---

### Task 8: adguard_list_filter_lists + adguard_list_user_rules + adguard_list_clients

**Files:**
- Create: `src/tools/adguard_list_filter_lists.ts`, `src/tools/adguard_list_user_rules.ts`, `src/tools/adguard_list_clients.ts`, plus 3 tests

- [ ] **Step 1: Write all 3 failing tests**

`tests/tools/list_filter_lists.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardListFilterListsTool } from "../../src/tools/adguard_list_filter_lists.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_list_filter_lists", () => {
  it("returns the filtering status with subscribed lists", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200,
        body: { filters: [{ url: "https://x", name: "X", enabled: true, rules_count: 100 }], user_rules: ["||a^"] } },
    ]);
    const tool = createAdguardListFilterListsTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", {});
    const payload = JSON.parse(r.content[0].text);
    expect(payload.filters).toHaveLength(1);
  });
});
```

`tests/tools/list_user_rules.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardListUserRulesTool } from "../../src/tools/adguard_list_user_rules.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_list_user_rules", () => {
  it("returns only the user_rules array", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200,
        body: { filters: [], user_rules: ["@@||t.co^", "||badsite.com^"] } },
    ]);
    const tool = createAdguardListUserRulesTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", {});
    const payload = JSON.parse(r.content[0].text);
    expect(payload.rules).toEqual(["@@||t.co^", "||badsite.com^"]);
  });
});
```

`tests/tools/list_clients.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardListClientsTool } from "../../src/tools/adguard_list_clients.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_list_clients", () => {
  it("returns the clients payload", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/clients", status: 200,
        body: { clients: [{ name: "client-laptop", ids: ["192.0.2.55"], blocked_services: ["youtube"] }] } },
    ]);
    const tool = createAdguardListClientsTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", {});
    const payload = JSON.parse(r.content[0].text);
    expect(payload.clients).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement all 3 tools**

`src/tools/adguard_list_filter_lists.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });

export function createAdguardListFilterListsTool(getClient: ClientFactory) {
  return {
    name: "adguard_list_filter_lists",
    label: "adguard: list filter lists",
    description: "List subscribed filter lists with enabled state and rule counts via GET /control/filtering/status.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const status = await client.get("/control/filtering/status");
      return jsonToolResult(status);
    },
  };
}
```

`src/tools/adguard_list_user_rules.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });

export function createAdguardListUserRulesTool(getClient: ClientFactory) {
  return {
    name: "adguard_list_user_rules",
    label: "adguard: list user rules",
    description: "List the custom user-rules block (lines like '@@||t.co^' or '||badsite.com^') via GET /control/filtering/status, returning just the rules array.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const status = await client.get<{ user_rules: string[] }>("/control/filtering/status");
      return jsonToolResult({ rules: status.user_rules ?? [] });
    },
  };
}
```

`src/tools/adguard_list_clients.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });

export function createAdguardListClientsTool(getClient: ClientFactory) {
  return {
    name: "adguard_list_clients",
    label: "adguard: list clients",
    description: "List configured clients with their per-client blocked services and tags via GET /control/clients.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const out = await client.get("/control/clients");
      return jsonToolResult(out);
    },
  };
}
```

- [ ] **Step 3: Run green + commit**

```bash
npx vitest run tests/tools/list_filter_lists.test.ts tests/tools/list_user_rules.test.ts tests/tools/list_clients.test.ts 2>&1 | tail -10
git add src/tools/adguard_list_filter_lists.ts src/tools/adguard_list_user_rules.ts src/tools/adguard_list_clients.ts tests/tools/list_filter_lists.test.ts tests/tools/list_user_rules.test.ts tests/tools/list_clients.test.ts
git commit -m "feat(tools): adguard_list_filter_lists + list_user_rules + list_clients"
```

---

## Phase 3: Tier 2 safe-write tools

### Task 9: adguard_add_user_rule + adguard_remove_user_rule

**Files:**
- Create: `src/tools/adguard_add_user_rule.ts`, `src/tools/adguard_remove_user_rule.ts`, plus 2 tests

- [ ] **Step 1: Write failing tests**

`tests/tools/add_user_rule.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardAddUserRuleTool } from "../../src/tools/adguard_add_user_rule.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_add_user_rule", () => {
  it("refuses without confirm: true", async () => {
    const tool = createAdguardAddUserRuleTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { rule: "@@||t.co^" })).rejects.toThrow(WriteGateError);
  });

  it("appends to user_rules and posts back via set_rules", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: ["||old^"] } },
      { method: "POST", path: "/control/filtering/set_rules", status: 200, body: {} },
    ]);
    const tool = createAdguardAddUserRuleTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.added).toBe("@@||t.co^");
    const post = fake.requests.find((q) => q.method === "POST")!;
    expect(JSON.parse(post.body)).toEqual({ rules: ["||old^", "@@||t.co^"] });
  });

  it("does not duplicate an existing rule", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: ["@@||t.co^"] } },
    ]);
    const tool = createAdguardAddUserRuleTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.already_present).toBe(true);
    expect(fake.requests.some((q) => q.method === "POST")).toBe(false);
  });
});
```

`tests/tools/remove_user_rule.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardRemoveUserRuleTool } from "../../src/tools/adguard_remove_user_rule.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_remove_user_rule", () => {
  it("refuses without confirm: true", async () => {
    const tool = createAdguardRemoveUserRuleTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { rule: "@@||t.co^" })).rejects.toThrow(WriteGateError);
  });

  it("removes exact-match rule and posts back", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: ["@@||t.co^", "||badsite.com^"] } },
      { method: "POST", path: "/control/filtering/set_rules", status: 200, body: {} },
    ]);
    const tool = createAdguardRemoveUserRuleTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.removed).toBe("@@||t.co^");
    const post = fake.requests.find((q) => q.method === "POST")!;
    expect(JSON.parse(post.body)).toEqual({ rules: ["||badsite.com^"] });
  });

  it("reports not_found when the rule is missing", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: ["||other^"] } },
    ]);
    const tool = createAdguardRemoveUserRuleTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.not_found).toBe(true);
  });
});
```

- [ ] **Step 2: Implement tools**

`src/tools/adguard_add_user_rule.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  rule: Type.String({ description: "AdGuard rule line, e.g. '@@||t.co^' or '||badsite.com^'." }),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_add_user_rule";

export function createAdguardAddUserRuleTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: add user rule",
    description: "Append a custom rule to the AdGuard user-rules block. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; rule: string };
      const client = getClient(args.instance);
      const status = await client.get<{ user_rules: string[] }>("/control/filtering/status");
      const existing = status.user_rules ?? [];
      if (existing.includes(args.rule)) {
        return jsonToolResult({ added: null, already_present: true, rules_count: existing.length });
      }
      const next = [...existing, args.rule];
      await client.post("/control/filtering/set_rules", { rules: next });
      return jsonToolResult({ added: args.rule, already_present: false, rules_count: next.length });
    },
  };
}
```

`src/tools/adguard_remove_user_rule.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  rule: Type.String({ description: "Exact-match rule line to remove from user_rules." }),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_remove_user_rule";

export function createAdguardRemoveUserRuleTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: remove user rule",
    description: "Remove an exact-match rule from the AdGuard user-rules block. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; rule: string };
      const client = getClient(args.instance);
      const status = await client.get<{ user_rules: string[] }>("/control/filtering/status");
      const existing = status.user_rules ?? [];
      if (!existing.includes(args.rule)) {
        return jsonToolResult({ removed: null, not_found: true, rules_count: existing.length });
      }
      const next = existing.filter((r) => r !== args.rule);
      await client.post("/control/filtering/set_rules", { rules: next });
      return jsonToolResult({ removed: args.rule, not_found: false, rules_count: next.length });
    },
  };
}
```

- [ ] **Step 3: Run green + commit**

```bash
npx vitest run tests/tools/add_user_rule.test.ts tests/tools/remove_user_rule.test.ts 2>&1 | tail -10
git add src/tools/adguard_add_user_rule.ts src/tools/adguard_remove_user_rule.ts tests/tools/add_user_rule.test.ts tests/tools/remove_user_rule.test.ts
git commit -m "feat(tools): adguard_add_user_rule + adguard_remove_user_rule (tier 2)"
```

---

### Task 10: filter list management (add + remove + toggle)

**Files:**
- Create: `src/tools/adguard_add_filter_list.ts`, `src/tools/adguard_remove_filter_list.ts`, `src/tools/adguard_toggle_filter_list.ts`, plus 3 tests

- [ ] **Step 1: Write failing tests**

`tests/tools/filter_list_ops.test.ts` (one test file for all 3):

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardAddFilterListTool } from "../../src/tools/adguard_add_filter_list.ts";
import { createAdguardRemoveFilterListTool } from "../../src/tools/adguard_remove_filter_list.ts";
import { createAdguardToggleFilterListTool } from "../../src/tools/adguard_toggle_filter_list.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });
const getClient = (f: FakeAdGuard) => () => new AdGuardClient({ url: f.baseUrl, username: "u", password: "p" });

describe("adguard_add_filter_list", () => {
  it("refuses without confirm", async () => {
    const tool = createAdguardAddFilterListTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { name: "X", url: "https://x.com/list.txt" })).rejects.toThrow(WriteGateError);
  });

  it("POSTs to /control/filtering/add_url", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/filtering/add_url", status: 200, body: {} }]);
    const tool = createAdguardAddFilterListTool(getClient(fake));
    await tool.execute("id", { name: "OISD Big", url: "https://big.oisd.nl/", confirm: true });
    expect(JSON.parse(fake.requests[0].body)).toEqual({ name: "OISD Big", url: "https://big.oisd.nl/", whitelist: false });
  });
});

describe("adguard_remove_filter_list", () => {
  it("refuses without confirm", async () => {
    const tool = createAdguardRemoveFilterListTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { url: "https://x" })).rejects.toThrow(WriteGateError);
  });

  it("POSTs to /control/filtering/remove_url", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/filtering/remove_url", status: 200, body: {} }]);
    const tool = createAdguardRemoveFilterListTool(getClient(fake));
    await tool.execute("id", { url: "https://big.oisd.nl/", confirm: true });
    expect(JSON.parse(fake.requests[0].body)).toEqual({ url: "https://big.oisd.nl/", whitelist: false });
  });
});

describe("adguard_toggle_filter_list", () => {
  it("refuses without confirm", async () => {
    const tool = createAdguardToggleFilterListTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { url: "https://x", enabled: false })).rejects.toThrow(WriteGateError);
  });

  it("POSTs to /control/filtering/set_url", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/filtering/set_url", status: 200, body: {} }]);
    const tool = createAdguardToggleFilterListTool(getClient(fake));
    await tool.execute("id", { url: "https://big.oisd.nl/", enabled: false, confirm: true });
    const sent = JSON.parse(fake.requests[0].body);
    expect(sent.url).toBe("https://big.oisd.nl/");
    expect(sent.data.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Implement add tool**

`src/tools/adguard_add_filter_list.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  name: Type.String({ description: "Display name for the list." }),
  url: Type.String({ description: "URL of the filter list to subscribe." }),
  whitelist: Type.Optional(Type.Boolean({ description: "When true, treat as an allowlist (default false)." })),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_add_filter_list";

export function createAdguardAddFilterListTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: add filter list",
    description: "Subscribe to a new filter list URL via POST /control/filtering/add_url. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; name: string; url: string; whitelist?: boolean };
      const client = getClient(args.instance);
      await client.post("/control/filtering/add_url", { name: args.name, url: args.url, whitelist: args.whitelist ?? false });
      return jsonToolResult({ added: { name: args.name, url: args.url } });
    },
  };
}
```

- [ ] **Step 3: Implement remove tool**

`src/tools/adguard_remove_filter_list.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  url: Type.String({ description: "URL of the filter list to unsubscribe." }),
  whitelist: Type.Optional(Type.Boolean({ description: "When true, target the allowlist set (default false)." })),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_remove_filter_list";

export function createAdguardRemoveFilterListTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: remove filter list",
    description: "Unsubscribe a filter list by URL via POST /control/filtering/remove_url. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; url: string; whitelist?: boolean };
      const client = getClient(args.instance);
      await client.post("/control/filtering/remove_url", { url: args.url, whitelist: args.whitelist ?? false });
      return jsonToolResult({ removed: args.url });
    },
  };
}
```

- [ ] **Step 4: Implement toggle tool**

`src/tools/adguard_toggle_filter_list.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  url: Type.String({ description: "URL of the filter list to enable/disable." }),
  enabled: Type.Boolean({ description: "Target enabled state." }),
  whitelist: Type.Optional(Type.Boolean({ description: "When true, target the allowlist set (default false)." })),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_toggle_filter_list";

export function createAdguardToggleFilterListTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: toggle filter list",
    description: "Enable or disable a subscribed filter list by URL via POST /control/filtering/set_url. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; url: string; enabled: boolean; whitelist?: boolean };
      const client = getClient(args.instance);
      await client.post("/control/filtering/set_url", { url: args.url, whitelist: args.whitelist ?? false, data: { enabled: args.enabled } });
      return jsonToolResult({ url: args.url, enabled: args.enabled });
    },
  };
}
```

- [ ] **Step 5: Run green + commit**

```bash
npx vitest run tests/tools/filter_list_ops.test.ts 2>&1 | tail -10
git add src/tools/adguard_add_filter_list.ts src/tools/adguard_remove_filter_list.ts src/tools/adguard_toggle_filter_list.ts tests/tools/filter_list_ops.test.ts
git commit -m "feat(tools): filter list add/remove/toggle (tier 2)"
```

---

### Task 11: adguard_set_client_blocked_services

**Files:**
- Create: `src/tools/adguard_set_client_blocked_services.ts`, `tests/tools/set_client_blocked_services.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardSetClientBlockedServicesTool } from "../../src/tools/adguard_set_client_blocked_services.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_set_client_blocked_services", () => {
  it("refuses without confirm", async () => {
    const tool = createAdguardSetClientBlockedServicesTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { name: "client-laptop", services: ["youtube"] })).rejects.toThrow(WriteGateError);
  });

  it("looks up client by name and updates blocked services", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/clients", status: 200,
        body: { clients: [{ name: "client-laptop", ids: ["192.0.2.55"], blocked_services: [] }] } },
      { method: "POST", path: "/control/clients/update", status: 200, body: {} },
    ]);
    const tool = createAdguardSetClientBlockedServicesTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { name: "client-laptop", services: ["youtube", "tiktok"], confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.client).toBe("client-laptop");
    expect(payload.blocked_services).toEqual(["youtube", "tiktok"]);
    const post = fake.requests.find((q) => q.method === "POST")!;
    const body = JSON.parse(post.body);
    expect(body.name).toBe("client-laptop");
    expect(body.data.blocked_services).toEqual(["youtube", "tiktok"]);
  });

  it("returns not_found when the client name is unknown", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/clients", status: 200, body: { clients: [{ name: "other", ids: ["x"], blocked_services: [] }] } },
    ]);
    const tool = createAdguardSetClientBlockedServicesTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { name: "ghost", services: ["youtube"], confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.not_found).toBe(true);
  });
});
```

- [ ] **Step 2: Implement tool**

`src/tools/adguard_set_client_blocked_services.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  name: Type.String({ description: "Client name as configured in AdGuard." }),
  services: Type.Array(Type.String(), { description: "Service ids to block (e.g. ['youtube','tiktok']). Empty array clears." }),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_set_client_blocked_services";

interface ClientRow {
  name: string;
  ids: string[];
  blocked_services?: string[];
  [k: string]: unknown;
}

export function createAdguardSetClientBlockedServicesTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: set client blocked services",
    description: "Set the per-client blocked-services list for a named client via POST /control/clients/update. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; name: string; services: string[] };
      const client = getClient(args.instance);
      const clients = await client.get<{ clients: ClientRow[] }>("/control/clients");
      const existing = (clients.clients ?? []).find((c) => c.name === args.name);
      if (!existing) return jsonToolResult({ client: args.name, not_found: true });
      const updated = { ...existing, blocked_services: args.services };
      await client.post("/control/clients/update", { name: args.name, data: updated });
      return jsonToolResult({ client: args.name, not_found: false, blocked_services: args.services });
    },
  };
}
```

- [ ] **Step 3: Run green + commit**

```bash
npx vitest run tests/tools/set_client_blocked_services.test.ts 2>&1 | tail -10
git add src/tools/adguard_set_client_blocked_services.ts tests/tools/set_client_blocked_services.test.ts
git commit -m "feat(tools): adguard_set_client_blocked_services (tier 2)"
```

---

## Phase 4: Tier 3 destructive tools

### Task 12: adguard_replace_user_rules + adguard_toggle_protection

**Files:**
- Create: `src/tools/adguard_replace_user_rules.ts`, `src/tools/adguard_toggle_protection.ts`, plus 2 tests

- [ ] **Step 1: Write failing tests**

`tests/tools/destructive.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardReplaceUserRulesTool } from "../../src/tools/adguard_replace_user_rules.ts";
import { createAdguardToggleProtectionTool } from "../../src/tools/adguard_toggle_protection.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });
const mk = (f: FakeAdGuard) => () => new AdGuardClient({ url: f.baseUrl, username: "u", password: "p" });

describe("adguard_replace_user_rules", () => {
  it("refuses without confirm + destructive", async () => {
    const tool = createAdguardReplaceUserRulesTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { rules: [] })).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { rules: [], confirm: true })).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { rules: [], destructive: true })).rejects.toThrow(WriteGateError);
  });

  it("posts the new rule set when fully confirmed", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/filtering/set_rules", status: 200, body: {} }]);
    const tool = createAdguardReplaceUserRulesTool(mk(fake));
    const r = await tool.execute("id", { rules: ["@@||t.co^"], confirm: true, destructive: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.rules_count).toBe(1);
    expect(JSON.parse(fake.requests[0].body)).toEqual({ rules: ["@@||t.co^"] });
  });
});

describe("adguard_toggle_protection", () => {
  it("refuses without confirm + destructive", async () => {
    const tool = createAdguardToggleProtectionTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { enabled: false })).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { enabled: false, confirm: true })).rejects.toThrow(WriteGateError);
  });

  it("posts to /control/protection when fully confirmed", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/protection", status: 200, body: {} }]);
    const tool = createAdguardToggleProtectionTool(mk(fake));
    const r = await tool.execute("id", { enabled: false, confirm: true, destructive: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.enabled).toBe(false);
    expect(JSON.parse(fake.requests[0].body)).toEqual({ enabled: false });
  });
});
```

- [ ] **Step 2: Implement replace_user_rules**

`src/tools/adguard_replace_user_rules.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertDestructive } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  rules: Type.Array(Type.String(), { description: "Complete replacement set of user rules. Overwrites the existing block." }),
  confirm: Type.Boolean({ description: "Must be true. Tier-3 destructive gate." }),
  destructive: Type.Boolean({ description: "Must be true. Tier-3 destructive gate (overwrites existing rules)." }),
}, { additionalProperties: false });

const NAME = "adguard_replace_user_rules";

export function createAdguardReplaceUserRulesTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: replace user rules",
    description: "Overwrite the entire user-rules block via POST /control/filtering/set_rules. Destroys any rule not in the new set. Tier-3 destructive; requires confirm:true and destructive:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertDestructive(raw, NAME);
      const args = raw as { instance?: string; rules: string[] };
      const client = getClient(args.instance);
      await client.post("/control/filtering/set_rules", { rules: args.rules });
      return jsonToolResult({ rules_count: args.rules.length });
    },
  };
}
```

- [ ] **Step 3: Implement toggle_protection**

`src/tools/adguard_toggle_protection.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertDestructive } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  enabled: Type.Boolean({ description: "Target global filtering state (false disables ALL blocking on this instance)." }),
  confirm: Type.Boolean({ description: "Must be true. Tier-3 destructive gate." }),
  destructive: Type.Boolean({ description: "Must be true. Tier-3 destructive gate (toggling off removes all blocking)." }),
}, { additionalProperties: false });

const NAME = "adguard_toggle_protection";

export function createAdguardToggleProtectionTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: toggle protection",
    description: "Enable or disable global AdGuard filtering via POST /control/protection. Tier-3 destructive (disabling stops ALL blocking); requires confirm:true and destructive:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertDestructive(raw, NAME);
      const args = raw as { instance?: string; enabled: boolean };
      const client = getClient(args.instance);
      await client.post("/control/protection", { enabled: args.enabled });
      return jsonToolResult({ enabled: args.enabled });
    },
  };
}
```

- [ ] **Step 4: Run green + commit**

```bash
npx vitest run tests/tools/destructive.test.ts 2>&1 | tail -10
git add src/tools/adguard_replace_user_rules.ts src/tools/adguard_toggle_protection.ts tests/tools/destructive.test.ts
git commit -m "feat(tools): adguard_replace_user_rules + adguard_toggle_protection (tier 3)"
```

---

## Phase 5: Server + entrypoints

### Task 13: tools/index.ts + index.ts plugin entry

**Files:**
- Create: `src/tools/index.ts`, `index.ts`

- [ ] **Step 1: Write src/tools/index.ts**

```typescript
export { createAdguardStatusTool } from "./adguard_status.ts";
export { createAdguardStatsTool } from "./adguard_stats.ts";
export { createAdguardQueryLogTool } from "./adguard_query_log.ts";
export { createAdguardListFilterListsTool } from "./adguard_list_filter_lists.ts";
export { createAdguardListUserRulesTool } from "./adguard_list_user_rules.ts";
export { createAdguardListClientsTool } from "./adguard_list_clients.ts";
export { createAdguardListBlockedServicesCatalogTool } from "./adguard_list_blocked_services_catalog.ts";
export { createAdguardAddUserRuleTool } from "./adguard_add_user_rule.ts";
export { createAdguardRemoveUserRuleTool } from "./adguard_remove_user_rule.ts";
export { createAdguardAddFilterListTool } from "./adguard_add_filter_list.ts";
export { createAdguardRemoveFilterListTool } from "./adguard_remove_filter_list.ts";
export { createAdguardToggleFilterListTool } from "./adguard_toggle_filter_list.ts";
export { createAdguardSetClientBlockedServicesTool } from "./adguard_set_client_blocked_services.ts";
export { createAdguardReplaceUserRulesTool } from "./adguard_replace_user_rules.ts";
export { createAdguardToggleProtectionTool } from "./adguard_toggle_protection.ts";
```

- [ ] **Step 2: Write index.ts (OpenClaw plugin entry)**

```typescript
import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import { resolveInstances, getInstanceConfig, type ResolvedConfig } from "./src/config.ts";
import { AdGuardClient } from "./src/adguard-client.ts";
import { registerSecret } from "./src/security.ts";
import * as tools from "./src/tools/index.ts";

function makeFactory(cfg: ResolvedConfig) {
  for (const inst of Object.values(cfg.instances)) registerSecret(inst.password);
  return (name?: string) => {
    const ic = getInstanceConfig(cfg, name);
    return new AdGuardClient(ic);
  };
}

export default definePluginEntry({
  id: "adguard",
  name: "AdGuard",
  description: "AdGuard Home control: status/stats/query log + user-rule and filter-list management + per-client service blocks. Multi-instance via env. Three-tier write gating.",
  register(api) {
    if (api.registrationMode !== "full") return;
    const cfg = resolveInstances(process.env);
    const getClient = makeFactory(cfg);
    api.registerTool(tools.createAdguardStatusTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardStatsTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardQueryLogTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardListFilterListsTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardListUserRulesTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardListClientsTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardListBlockedServicesCatalogTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardAddUserRuleTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardRemoveUserRuleTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardAddFilterListTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardRemoveFilterListTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardToggleFilterListTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardSetClientBlockedServicesTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardReplaceUserRulesTool(getClient) as AnyAgentTool);
    api.registerTool(tools.createAdguardToggleProtectionTool(getClient) as AnyAgentTool);
  },
});
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck 2>&1 | tail -10
git add src/tools/index.ts index.ts
git commit -m "feat(plugin): tools barrel + OpenClaw plugin entry"
```

---

### Task 14: mcp-server.ts + openclaw.plugin.json

**Files:**
- Create: `mcp-server.ts`, `openclaw.plugin.json`

- [ ] **Step 1: Write mcp-server.ts**

```typescript
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { resolveInstances, getInstanceConfig, type ResolvedConfig } from "./src/config.ts";
import { AdGuardClient } from "./src/adguard-client.ts";
import { registerSecret, redact } from "./src/security.ts";
import * as toolFactories from "./src/tools/index.ts";

const cfg: ResolvedConfig = resolveInstances(process.env);
for (const inst of Object.values(cfg.instances)) registerSecret(inst.password);

const getClient = (name?: string) => new AdGuardClient(getInstanceConfig(cfg, name));

const tools = [
  toolFactories.createAdguardStatusTool(getClient),
  toolFactories.createAdguardStatsTool(getClient),
  toolFactories.createAdguardQueryLogTool(getClient),
  toolFactories.createAdguardListFilterListsTool(getClient),
  toolFactories.createAdguardListUserRulesTool(getClient),
  toolFactories.createAdguardListClientsTool(getClient),
  toolFactories.createAdguardListBlockedServicesCatalogTool(getClient),
  toolFactories.createAdguardAddUserRuleTool(getClient),
  toolFactories.createAdguardRemoveUserRuleTool(getClient),
  toolFactories.createAdguardAddFilterListTool(getClient),
  toolFactories.createAdguardRemoveFilterListTool(getClient),
  toolFactories.createAdguardToggleFilterListTool(getClient),
  toolFactories.createAdguardSetClientBlockedServicesTool(getClient),
  toolFactories.createAdguardReplaceUserRulesTool(getClient),
  toolFactories.createAdguardToggleProtectionTool(getClient),
];

const toolMap = new Map(tools.map((t) => [t.name, t]));

const server = new Server({ name: "adguard-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.parameters })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const t = toolMap.get(req.params.name);
  if (!t) {
    return { content: [{ type: "text", text: JSON.stringify({ error: `unknown tool: ${req.params.name}` }) }], isError: true };
  }
  try {
    return await t.execute(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>);
  } catch (e) {
    const msg = redact((e as Error).message) as string;
    return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Write openclaw.plugin.json**

```json
{
  "schemaVersion": 1,
  "id": "adguard",
  "name": "AdGuard",
  "version": "0.1.0",
  "description": "AdGuard Home read/write tools across one or more instances.",
  "entry": "./dist/index.js",
  "activation": { "onStartup": true },
  "compat": { "openclaw": ">=2026.4.22" },
  "permissions": [],
  "configSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

- [ ] **Step 3: Build + typecheck**

```bash
npm run typecheck 2>&1 | tail -10
npm run build 2>&1 | tail -10
ls dist/
```

Expected: `dist/mcp-server.js` and `dist/index.js` exist.

- [ ] **Step 4: Commit**

```bash
git add mcp-server.ts openclaw.plugin.json
git commit -m "feat(server): MCP stdio entry + OpenClaw plugin manifest"
```

---

### Task 15: README.md (5-client setup)

**Files:**
- Create: `README.md`, `LICENSE`

- [ ] **Step 1: Write README**

```markdown
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
```

- [ ] **Step 2: Write LICENSE**

```
MIT License

Copyright (c) 2026 Solomon Neas

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: README with 5-client setup + LICENSE"
```

---

## Phase 6: Integration + publish prep

### Task 16: integration smoke test + npm pack check

**Files:**
- Create: `tests/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "./fake-adguard.ts";
import { AdGuardClient } from "../src/adguard-client.ts";
import * as toolFactories from "../src/tools/index.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("integration", () => {
  it("all 15 tools register with unique names", () => {
    const dummy = () => new AdGuardClient({ url: "http://x", username: "u", password: "p" });
    const created = [
      toolFactories.createAdguardStatusTool(dummy),
      toolFactories.createAdguardStatsTool(dummy),
      toolFactories.createAdguardQueryLogTool(dummy),
      toolFactories.createAdguardListFilterListsTool(dummy),
      toolFactories.createAdguardListUserRulesTool(dummy),
      toolFactories.createAdguardListClientsTool(dummy),
      toolFactories.createAdguardListBlockedServicesCatalogTool(dummy),
      toolFactories.createAdguardAddUserRuleTool(dummy),
      toolFactories.createAdguardRemoveUserRuleTool(dummy),
      toolFactories.createAdguardAddFilterListTool(dummy),
      toolFactories.createAdguardRemoveFilterListTool(dummy),
      toolFactories.createAdguardToggleFilterListTool(dummy),
      toolFactories.createAdguardSetClientBlockedServicesTool(dummy),
      toolFactories.createAdguardReplaceUserRulesTool(dummy),
      toolFactories.createAdguardToggleProtectionTool(dummy),
    ];
    expect(created).toHaveLength(15);
    const names = created.map((t) => t.name);
    expect(new Set(names).size).toBe(15);
    for (const n of names) expect(n).toMatch(/^adguard_/);
  });

  it("end-to-end: status read + user rule add via the fake server", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/status", status: 200, body: { version: "v0.107.50", protection_enabled: true } },
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: [] } },
      { method: "POST", path: "/control/filtering/set_rules", status: 200, body: {} },
    ]);
    const mkClient = () => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" });
    const status = toolFactories.createAdguardStatusTool(mkClient);
    const addRule = toolFactories.createAdguardAddUserRuleTool(mkClient);

    const sr = await status.execute("id", {});
    expect(JSON.parse(sr.content[0].text).version).toBe("v0.107.50");

    const ar = await addRule.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(ar.content[0].text);
    expect(payload.added).toBe("@@||t.co^");
  });
});
```

- [ ] **Step 2: Run full suite**

```bash
cd ~/repos/adguard-mcp && npm test 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: npm pack dry-run**

```bash
npm pack --dry-run 2>&1 | tail -20
```

Verify the tarball includes `dist/`, `openclaw.plugin.json`, `README.md`, `LICENSE` and excludes `node_modules/`, `tests/`, `src/`, `.claude/`, `.env`. If anything wrong, adjust `files` in package.json.

- [ ] **Step 4: typecheck + build pass**

```bash
npm run typecheck 2>&1 | tail -5
npm run build 2>&1 | tail -5
node dist/mcp-server.js &
SERVER_PID=$!
sleep 1
kill $SERVER_PID 2>/dev/null
echo "server started + exited cleanly"
```

The server will error on startup without env vars set (NoInstancesError), which is correct - just confirm the binary is reachable.

- [ ] **Step 5: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: integration smoke - 15 tools register + end-to-end"
```

---

### Task 17: GitHub repo + first push

**Files:** none

- [ ] **Step 1: Create the remote repo**

```bash
gh repo create solomonneas/adguard-mcp \
  --public \
  --description "MCP server for AdGuard Home: 15 tools across read/safe-write/destructive tiers, multi-instance" \
  --source ~/repos/adguard-mcp \
  --remote origin \
  --push=false
```

- [ ] **Step 2: First push**

```bash
cd ~/repos/adguard-mcp && git push -u origin master 2>&1 | tail -3
```

- [ ] **Step 3: Verify**

```bash
gh repo view solomonneas/adguard-mcp --json url,visibility,defaultBranchRef
```

Expected: public, master branch, URL printed.

- [ ] **Step 4: No commit needed - push complete**

---

## Self-review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| package.json + tsconfig + tsup + vitest config | Task 1 |
| src/config.ts (multi-instance env) | Task 2 |
| src/adguard-client.ts (basic auth, retry) | Task 3 |
| src/security.ts (redact) | Task 4 |
| src/gates.ts (assertConfirmedWrite/Destructive) | Task 5 |
| 7 read tools | Tasks 6, 7, 8 |
| 6 safe-write tools | Tasks 9, 10, 11 |
| 2 destructive tools | Task 12 |
| tools barrel + plugin entry | Task 13 |
| MCP stdio server + openclaw.plugin.json | Task 14 |
| README (5 clients) + LICENSE | Task 15 |
| integration smoke + npm pack | Task 16 |
| GitHub repo + push | Task 17 |

Every spec requirement maps to a task.

**2. Placeholder scan:** No TBDs. All commands concrete. All file paths absolute. No "similar to Task N" - code blocks repeated where the engineer might read out of order.

**3. Type consistency:** `ClientFactory` is `(instance?: string) => AdGuardClient` throughout. `getClient` is the runtime instance. Tool factories are `createXxxTool(getClient: ClientFactory)` returning `{name, label, description, parameters, execute}`. Test helpers consistent: `startFakeAdGuard`, `FakeAdGuard.routes/requests/close`.

---

## Execution

After all 17 tasks land:

```bash
cd ~/repos/adguard-mcp
npm test
npm run build
gh repo view solomonneas/adguard-mcp
```

Operator follow-up (build-but-don't-flip):
1. Set `ADGUARD_PRIMARY_URL`, `ADGUARD_PRIMARY_USERNAME`, `ADGUARD_PRIMARY_PASSWORD` (and `ADGUARD_SECONDARY_*` if using both boxes) in `~/.openclaw/workspace/.env`.
2. Add MCP entry to whichever client config(s) you use. README has setup for all five.
3. Run `adguard_status` from your AI client to verify auth works.
4. Optionally `npm publish` to npm registry + `npx clawhub package publish` for ClawHub when ready.
