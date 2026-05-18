import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  whitelist: Type.Optional(Type.Boolean({ description: "Refresh allowlist lists instead of blocklist lists. Default: false (refresh blocklists)." })),
  confirm: Type.Boolean({ description: "Must be true. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_refresh_filter_lists";

export function createAdguardRefreshFilterListsTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: refresh filter lists",
    description: "Force refresh subscribed filter lists immediately via POST /control/filtering/refresh. Returns the number of lists updated. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; whitelist?: boolean };
      const client = getClient(args.instance);
      const result = await client.post("/control/filtering/refresh", { whitelist: args.whitelist === true });
      return jsonToolResult(result);
    },
  };
}
