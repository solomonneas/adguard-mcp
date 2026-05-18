import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardToggleSafebrowsingTool } from "../../src/tools/adguard_toggle_safebrowsing.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_toggle_safebrowsing", () => {
  it("refuses without confirm: true", async () => {
    const tool = createAdguardToggleSafebrowsingTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { enabled: true })).rejects.toThrow(WriteGateError);
  });

  it("POSTs to /control/safebrowsing/enable when enabled:true (no body) and to /disable when enabled:false", async () => {
    fake = await startFakeAdGuard([
      { method: "POST", path: "/control/safebrowsing/enable", status: 200, body: {} },
      { method: "POST", path: "/control/safebrowsing/disable", status: 200, body: {} },
    ]);
    const tool = createAdguardToggleSafebrowsingTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));

    const rOn = await tool.execute("id", { confirm: true, enabled: true });
    const payloadOn = JSON.parse(rOn.content[0].text);
    expect(payloadOn.set).toBe(true);
    expect(payloadOn.enabled).toBe(true);
    const reqOn = fake.requests[0];
    expect(reqOn.method).toBe("POST");
    expect(reqOn.path).toBe("/control/safebrowsing/enable");
    expect(reqOn.body).toBe("");

    const rOff = await tool.execute("id", { confirm: true, enabled: false });
    const payloadOff = JSON.parse(rOff.content[0].text);
    expect(payloadOff.enabled).toBe(false);
    const reqOff = fake.requests[1];
    expect(reqOff.method).toBe("POST");
    expect(reqOff.path).toBe("/control/safebrowsing/disable");
    expect(reqOff.body).toBe("");
  });
});
