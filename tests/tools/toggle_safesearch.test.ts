import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardToggleSafesearchTool } from "../../src/tools/adguard_toggle_safesearch.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_toggle_safesearch", () => {
  it("refuses without confirm: true", async () => {
    const tool = createAdguardToggleSafesearchTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { enabled: true })).rejects.toThrow(WriteGateError);
  });

  it("PUTs to /control/safesearch/settings; when enabled:false, all engine flags default to false (not true)", async () => {
    fake = await startFakeAdGuard([
      { method: "PUT", path: "/control/safesearch/settings", status: 200, body: {} },
    ]);
    const tool = createAdguardToggleSafesearchTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { confirm: true, enabled: false });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.set).toBe(true);
    expect(payload.enabled).toBe(false);
    const req = fake.requests.find((q) => q.method === "PUT")!;
    expect(req.method).toBe("PUT");
    expect(req.path).toBe("/control/safesearch/settings");
    expect(JSON.parse(req.body)).toEqual({
      enabled: false,
      bing: false,
      duckduckgo: false,
      ecosia: false,
      google: false,
      pixabay: false,
      yandex: false,
      youtube: false,
    });
  });

  it("when enabled:false, explicit per-engine true is forced to false", async () => {
    fake = await startFakeAdGuard([
      { method: "PUT", path: "/control/safesearch/settings", status: 200, body: {} },
    ]);
    const tool = createAdguardToggleSafesearchTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    await tool.execute("id", { confirm: true, enabled: false, google: true, bing: true });
    const req = fake.requests.find((q) => q.method === "PUT")!;
    const body = JSON.parse(req.body);
    expect(body.enabled).toBe(false);
    // Every engine, including those the caller explicitly set to true, must be false.
    for (const e of ["bing", "duckduckgo", "ecosia", "google", "pixabay", "yandex", "youtube"]) {
      expect(body[e]).toBe(false);
    }
  });

  it("when enabled:true, explicit per-engine false is preserved", async () => {
    fake = await startFakeAdGuard([
      { method: "PUT", path: "/control/safesearch/settings", status: 200, body: {} },
    ]);
    const tool = createAdguardToggleSafesearchTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    await tool.execute("id", { confirm: true, enabled: true, google: false });
    const req = fake.requests.find((q) => q.method === "PUT")!;
    const body = JSON.parse(req.body);
    expect(body.enabled).toBe(true);
    expect(body.google).toBe(false);
    // Engines the caller did not mention should default to true when enabled is true.
    expect(body.bing).toBe(true);
    expect(body.youtube).toBe(true);
  });
});
