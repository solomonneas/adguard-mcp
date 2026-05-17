import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardAddFilterListTool } from "../../src/tools/adguard_add_filter_list.ts";
import { createAdguardRemoveFilterListTool } from "../../src/tools/adguard_remove_filter_list.ts";
import { createAdguardToggleFilterListTool } from "../../src/tools/adguard_toggle_filter_list.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });
const getClient = (f: FakeAdGuard) => () => new AdGuardClient({ url: f.baseUrl, username: "u", password: "p" });

describe("adguard_add_filter_list", () => {
  it("refuses without confirm", async () => {
    const tool = createAdguardAddFilterListTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { name: "X", url: "https://x.com/list.txt" })).rejects.toThrow(WriteGateError);
  });

  it("POSTs to /control/filtering/add_url", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/filtering/add_url", status: 200, body: {} }]);
    const tool = createAdguardAddFilterListTool(getClient(fake));
    await tool.execute("id", { name: "OISD Big", url: "https://big.oisd.nl/", confirm: true });
    expect(JSON.parse(fake.requests[0].body)).toEqual({ name: "OISD Big", url: "https://big.oisd.nl/", whitelist: false });
  });
});

describe("adguard_remove_filter_list", () => {
  it("refuses without confirm", async () => {
    const tool = createAdguardRemoveFilterListTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { url: "https://x" })).rejects.toThrow(WriteGateError);
  });

  it("POSTs to /control/filtering/remove_url", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/filtering/remove_url", status: 200, body: {} }]);
    const tool = createAdguardRemoveFilterListTool(getClient(fake));
    await tool.execute("id", { url: "https://big.oisd.nl/", confirm: true });
    expect(JSON.parse(fake.requests[0].body)).toEqual({ url: "https://big.oisd.nl/", whitelist: false });
  });
});

describe("adguard_toggle_filter_list", () => {
  it("refuses without confirm", async () => {
    const tool = createAdguardToggleFilterListTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { url: "https://x", enabled: false })).rejects.toThrow(WriteGateError);
  });

  it("POSTs to /control/filtering/set_url", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/filtering/set_url", status: 200, body: {} }]);
    const tool = createAdguardToggleFilterListTool(getClient(fake));
    await tool.execute("id", { url: "https://big.oisd.nl/", enabled: false, confirm: true });
    const sent = JSON.parse(fake.requests[0].body);
    expect(sent.url).toBe("https://big.oisd.nl/");
    expect(sent.data.enabled).toBe(false);
  });
});
