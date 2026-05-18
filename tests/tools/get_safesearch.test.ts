import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardGetSafesearchSettingsTool } from "../../src/tools/adguard_get_safesearch_settings.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_get_safesearch_settings", () => {
  it("returns safesearch enabled state + per-engine flags", async () => {
    const payload = { enabled: true, bing: true, duckduckgo: true, ecosia: false, google: true, pixabay: false, yandex: true, youtube: true };
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/safesearch/status", status: 200, body: payload },
    ]);
    const tool = createAdguardGetSafesearchSettingsTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", {});
    const result = JSON.parse(r.content[0].text);
    expect(result.enabled).toBe(true);
    expect(result.youtube).toBe(true);
    expect(result.ecosia).toBe(false);
  });
});
