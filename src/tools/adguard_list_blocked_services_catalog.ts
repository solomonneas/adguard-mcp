import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });

export function createAdguardListBlockedServicesCatalogTool(getClient: ClientFactory) {
  return {
    name: "adguard_list_blocked_services_catalog",
    label: "adguard: blocked services catalog",
    description: "List the services AdGuard Home can block per-client (youtube, tiktok, instagram, etc) via GET /control/blocked_services/services.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const catalog = await client.get("/control/blocked_services/services");
      return jsonToolResult(catalog);
    },
  };
}
