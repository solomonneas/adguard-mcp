import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardClearQueryLogTool } from "../../src/tools/adguard_clear_query_log.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });
const mk = (f: FakeAdGuard) => () => new AdGuardClient({ url: f.baseUrl, username: "u", password: "p" });

describe("adguard_clear_query_log", () => {
  it("refuses without confirm + destructive", async () => {
    const tool = createAdguardClearQueryLogTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", {})).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { confirm: true })).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { destructive: true })).rejects.toThrow(WriteGateError);
  });

  it("posts to /control/querylog_clear (underscore, NOT /querylog/clear) when fully confirmed", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/querylog_clear", status: 200, body: {} }]);
    const tool = createAdguardClearQueryLogTool(mk(fake));
    const r = await tool.execute("id", { confirm: true, destructive: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.cleared).toBe(true);
    const req = fake.requests[0];
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/control/querylog_clear");
    expect(req.path).not.toContain("/querylog/clear");
  });
});
