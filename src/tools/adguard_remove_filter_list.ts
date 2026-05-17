import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  url: Type.String({ description: "URL of the filter list to unsubscribe." }),
  whitelist: Type.Optional(Type.Boolean({ description: "When true, target the allowlist set (default false)." })),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_remove_filter_list";

export function createAdguardRemoveFilterListTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: remove filter list",
    description: "Unsubscribe a filter list by URL via POST /control/filtering/remove_url. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; url: string; whitelist?: boolean };
      const client = getClient(args.instance);
      await client.post("/control/filtering/remove_url", { url: args.url, whitelist: args.whitelist ?? false });
      return jsonToolResult({ removed: args.url });
    },
  };
}
