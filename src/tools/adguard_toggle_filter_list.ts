import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  url: Type.String({ description: "URL of the filter list to enable/disable." }),
  enabled: Type.Boolean({ description: "Target enabled state." }),
  whitelist: Type.Optional(Type.Boolean({ description: "When true, target the allowlist set (default false)." })),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_toggle_filter_list";

export function createAdguardToggleFilterListTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: toggle filter list",
    description: "Enable or disable a subscribed filter list by URL via POST /control/filtering/set_url. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; url: string; enabled: boolean; whitelist?: boolean };
      const client = getClient(args.instance);
      await client.post("/control/filtering/set_url", { url: args.url, whitelist: args.whitelist ?? false, data: { enabled: args.enabled } });
      return jsonToolResult({ url: args.url, enabled: args.enabled });
    },
  };
}
