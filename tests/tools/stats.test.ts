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
