import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  name: Type.String({ description: "Display name for the list." }),
  url: Type.String({ description: "URL of the filter list to subscribe." }),
  whitelist: Type.Optional(Type.Boolean({ description: "When true, treat as an allowlist (default false)." })),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_add_filter_list";

export function createAdguardAddFilterListTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: add filter list",
    description: "Subscribe to a new filter list URL via POST /control/filtering/add_url. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; name: string; url: string; whitelist?: boolean };
      const client = getClient(args.instance);
      await client.post("/control/filtering/add_url", { name: args.name, url: args.url, whitelist: args.whitelist ?? false });
      return jsonToolResult({ added: { name: args.name, url: args.url } });
    },
  };
}
