import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertDestructive } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  name: Type.String({ description: "Name of the configured client to remove." }),
  confirm: Type.Boolean({ description: "Must be true. Tier-3 destructive gate." }),
  destructive: Type.Boolean({ description: "Must be true. Tier-3 destructive gate (deleting a client drops per-client rules and stats)." }),
}, { additionalProperties: false });

const NAME = "adguard_delete_client";

export function createAdguardDeleteClientTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: delete client",
    description: "Remove a configured named client via POST /control/clients/delete. Tier-3 destructive; per-client rules and per-client filtering settings are lost. Requires confirm:true and destructive:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertDestructive(raw, NAME);
      const args = raw as { instance?: string; name: string };
      const client = getClient(args.instance);
      await client.post("/control/clients/delete", { name: args.name });
      return jsonToolResult({ deleted: true, name: args.name });
    },
  };
}
