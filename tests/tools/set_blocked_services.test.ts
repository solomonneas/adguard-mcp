import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardSetBlockedServicesTool } from "../../src/tools/adguard_set_blocked_services.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_set_blocked_services", () => {
  it("refuses without confirm: true", async () => {
    const tool = createAdguardSetBlockedServicesTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { ids: ["youtube"] })).rejects.toThrow(WriteGateError);
  });

  it("PUTs to /control/blocked_services/update and converts HH:MM strings to ms", async () => {
    fake = await startFakeAdGuard([
      { method: "PUT", path: "/control/blocked_services/update", status: 200, body: {} },
    ]);
    const tool = createAdguardSetBlockedServicesTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", {
      confirm: true,
      ids: ["youtube", "tiktok"],
      schedule: {
        time_zone: "America/New_York",
        mon: { start: "08:00", end: "18:00" },
        tue: { start: 28800000, end: 64800000 },
      },
    });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.set).toBe(true);
    expect(payload.count).toBe(2);
    const req = fake.requests.find((q) => q.method === "PUT")!;
    expect(req.method).toBe("PUT");
    expect(req.path).toBe("/control/blocked_services/update");
    expect(JSON.parse(req.body)).toEqual({
      ids: ["youtube", "tiktok"],
      schedule: {
        time_zone: "America/New_York",
        mon: { start: 28800000, end: 64800000 },
        tue: { start: 28800000, end: 64800000 },
      },
    });
  });
});
