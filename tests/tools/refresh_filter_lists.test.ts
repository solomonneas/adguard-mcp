import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardRefreshFilterListsTool } from "../../src/tools/adguard_refresh_filter_lists.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_refresh_filter_lists", () => {
  it("refuses without confirm: true", async () => {
    const tool = createAdguardRefreshFilterListsTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", {})).rejects.toThrow(WriteGateError);
  });

  it("posts to /control/filtering/refresh with default whitelist: false", async () => {
    fake = await startFakeAdGuard([
      { method: "POST", path: "/control/filtering/refresh", status: 200, body: { updated: 3 } },
    ]);
    const tool = createAdguardRefreshFilterListsTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.updated).toBe(3);
    const req = fake.requests.find((q) => q.method === "POST")!;
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/control/filtering/refresh");
    expect(JSON.parse(req.body)).toEqual({ whitelist: false });
  });
});
