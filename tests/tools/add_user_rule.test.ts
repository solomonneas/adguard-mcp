import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardAddUserRuleTool } from "../../src/tools/adguard_add_user_rule.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_add_user_rule", () => {
  it("refuses without confirm: true", async () => {
    const tool = createAdguardAddUserRuleTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { rule: "@@||t.co^" })).rejects.toThrow(WriteGateError);
  });

  it("appends to user_rules and posts back via set_rules", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: ["||old^"] } },
      { method: "POST", path: "/control/filtering/set_rules", status: 200, body: {} },
    ]);
    const tool = createAdguardAddUserRuleTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.added).toBe("@@||t.co^");
    const post = fake.requests.find((q) => q.method === "POST")!;
    expect(JSON.parse(post.body)).toEqual({ rules: ["||old^", "@@||t.co^"] });
  });

  it("does not duplicate an existing rule", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: ["@@||t.co^"] } },
    ]);
    const tool = createAdguardAddUserRuleTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.already_present).toBe(true);
    expect(fake.requests.some((q) => q.method === "POST")).toBe(false);
  });
});
