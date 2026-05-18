import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardResetStatsTool } from "../../src/tools/adguard_reset_stats.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });
const mk = (f: FakeAdGuard) => () => new AdGuardClient({ url: f.baseUrl, username: "u", password: "p" });

describe("adguard_reset_stats", () => {
  it("refuses without confirm + destructive", async () => {
    const tool = createAdguardResetStatsTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", {})).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { confirm: true })).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { destructive: true })).rejects.toThrow(WriteGateError);
  });

  it("posts to /control/stats_reset (underscore, NOT /stats/reset) when fully confirmed", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/stats_reset", status: 200, body: {} }]);
    const tool = createAdguardResetStatsTool(mk(fake));
    const r = await tool.execute("id", { confirm: true, destructive: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.reset).toBe(true);
    const req = fake.requests[0];
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/control/stats_reset");
    expect(req.path).not.toContain("/stats/reset");
  });
});
