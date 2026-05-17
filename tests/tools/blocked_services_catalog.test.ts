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
