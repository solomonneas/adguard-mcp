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
