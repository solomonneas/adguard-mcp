import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  name: Type.String({ description: "Current name of the client to update (used to find the existing record)." }),
  data: Type.Object({}, { additionalProperties: true, description: "Full new Client object (AGH replaces the record; this is NOT a partial merge). Include name (new), ids, and any per-client settings to preserve." }),
  confirm: Type.Boolean({ description: "Must be true. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_update_client";

export function createAdguardUpdateClientTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: update client",
    description: "Update an existing named client via POST /control/clients/update. Body is nested {name, data} where data replaces the full client record. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; name: string; data: Record<string, unknown> };
      const client = getClient(args.instance);
      await client.post("/control/clients/update", { name: args.name, data: args.data });
      return jsonToolResult({ updated: true, name: args.name });
    },
  };
}
