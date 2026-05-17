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
