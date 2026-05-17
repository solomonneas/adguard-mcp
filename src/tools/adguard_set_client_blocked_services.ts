import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  name: Type.String({ description: "Client name as configured in AdGuard." }),
  services: Type.Array(Type.String(), { description: "Service ids to block (e.g. ['youtube','tiktok']). Empty array clears." }),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_set_client_blocked_services";

interface ClientRow {
  name: string;
  ids: string[];
  blocked_services?: string[];
  [k: string]: unknown;
}

export function createAdguardSetClientBlockedServicesTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: set client blocked services",
    description: "Set the per-client blocked-services list for a named client via POST /control/clients/update. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; name: string; services: string[] };
      const client = getClient(args.instance);
      const clients = await client.get<{ clients: ClientRow[] }>("/control/clients");
      const existing = (clients.clients ?? []).find((c) => c.name === args.name);
      if (!existing) return jsonToolResult({ client: args.name, not_found: true });
      const updated = { ...existing, blocked_services: args.services };
      await client.post("/control/clients/update", { name: args.name, data: updated });
      return jsonToolResult({ client: args.name, not_found: false, blocked_services: args.services });
    },
  };
}
