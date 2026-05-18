import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardDeleteClientTool } from "../../src/tools/adguard_delete_client.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });
const mk = (f: FakeAdGuard) => () => new AdGuardClient({ url: f.baseUrl, username: "u", password: "p" });

describe("adguard_delete_client", () => {
  it("refuses without confirm + destructive", async () => {
    const tool = createAdguardDeleteClientTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { name: "phone" })).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { name: "phone", confirm: true })).rejects.toThrow(WriteGateError);
    await expect(tool.execute("id", { name: "phone", destructive: true })).rejects.toThrow(WriteGateError);
  });

  it("posts to /control/clients/delete with {name} when fully confirmed", async () => {
    fake = await startFakeAdGuard([{ method: "POST", path: "/control/clients/delete", status: 200, body: {} }]);
    const tool = createAdguardDeleteClientTool(mk(fake));
    const r = await tool.execute("id", { name: "phone", confirm: true, destructive: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.deleted).toBe(true);
    expect(payload.name).toBe("phone");
    const req = fake.requests[0];
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/control/clients/delete");
    expect(JSON.parse(req.body)).toEqual({ name: "phone" });
  });
});
