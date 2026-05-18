import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardGetBlockedServicesTool } from "../../src/tools/adguard_get_blocked_services.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_get_blocked_services", () => {
  it("returns global blocked-services schedule + ids", async () => {
    const payload = { schedule: { time_zone: "America/New_York", mon: { start: 28800000, end: 64800000 } }, ids: ["youtube", "tiktok"] };
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/blocked_services/get", status: 200, body: payload },
    ]);
    const tool = createAdguardGetBlockedServicesTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", {});
    const result = JSON.parse(r.content[0].text);
    expect(result.ids).toEqual(["youtube", "tiktok"]);
    expect(result.schedule.time_zone).toBe("America/New_York");
  });

  it("returns empty ids cleanly when no services blocked", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/blocked_services/get", status: 200, body: { schedule: { time_zone: "UTC" }, ids: [] } },
    ]);
    const tool = createAdguardGetBlockedServicesTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", {});
    const result = JSON.parse(r.content[0].text);
    expect(result.ids).toEqual([]);
  });
});
