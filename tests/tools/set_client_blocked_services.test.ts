import { describe, it, expect, afterEach } from "vitest";
import { startFakeAdGuard, FakeAdGuard } from "../fake-adguard.ts";
import { AdGuardClient } from "../../src/adguard-client.ts";
import { createAdguardSetClientBlockedServicesTool } from "../../src/tools/adguard_set_client_blocked_services.ts";
import { WriteGateError } from "../../src/gates.ts";

let fake: FakeAdGuard | null = null;
afterEach(async () => { if (fake) await fake.close(); fake = null; });

describe("adguard_set_client_blocked_services", () => {
  it("refuses without confirm", async () => {
    const tool = createAdguardSetClientBlockedServicesTool(() => new AdGuardClient({ url: "http://x", username: "u", password: "p" }));
    await expect(tool.execute("id", { name: "client-laptop", services: ["youtube"] })).rejects.toThrow(WriteGateError);
  });

  it("looks up client by name and updates blocked services", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/clients", status: 200,
        body: { clients: [{ name: "client-laptop", ids: ["192.0.2.55"], blocked_services: [] }] } },
      { method: "POST", path: "/control/clients/update", status: 200, body: {} },
    ]);
    const tool = createAdguardSetClientBlockedServicesTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { name: "client-laptop", services: ["youtube", "tiktok"], confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.client).toBe("client-laptop");
    expect(payload.blocked_services).toEqual(["youtube", "tiktok"]);
    const post = fake.requests.find((q) => q.method === "POST")!;
    const body = JSON.parse(post.body);
    expect(body.name).toBe("client-laptop");
    expect(body.data.blocked_services).toEqual(["youtube", "tiktok"]);
  });

  it("returns not_found when the client name is unknown", async () => {
    fake = await startFakeAdGuard([
      { method: "GET", path: "/control/clients", status: 200, body: { clients: [{ name: "other", ids: ["x"], blocked_services: [] }] } },
    ]);
    const tool = createAdguardSetClientBlockedServicesTool(() => new AdGuardClient({ url: fake!.baseUrl, username: "u", password: "p" }));
    const r = await tool.execute("id", { name: "ghost", services: ["youtube"], confirm: true });
    const payload = JSON.parse(r.content[0].text);
    expect(payload.not_found).toBe(true);
  });
});
