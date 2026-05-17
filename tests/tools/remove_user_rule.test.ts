import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardRemoveUserRuleTool } from "../../src/tools/adguard_remove_user_rule.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_remove_user_rule", () => {
  it("refuses without confirm: true", async () => {
    const tool = createAdguardRemoveUserRuleTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { rule: "@@||t.co^" })).rejects.toThrow(WriteGateError);
  });

  it("removes exact-match rule and posts back", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: ["@@||t.co^", "||badsite.com^"] } },
      { method: "POST", path: "/control/filtering/set_rules", status: 200, body: {} },
    ]);
    const tool = createAdguardRemoveUserRuleTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.removed).toBe("@@||t.co^");
    const post = fake.requests.find((q) => q.method === "POST")!;
    expect(JSON.parse(post.body)).toEqual({ rules: ["||badsite.com^"] });
  });

  it("reports not_found when the rule is missing", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/filtering/status", status: 200, body: { user_rules: ["||other^"] } },
    ]);
    const tool = createAdguardRemoveUserRuleTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { rule: "@@||t.co^", confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.not_found).toBe(true);
  });
});
