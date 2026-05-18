import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });
const NAME = "adguard_get_blocked_services";

export function createAdguardGetBlockedServicesTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: get blocked services",
    description: "Get the GLOBAL blocked-services list and weekly schedule via GET /control/blocked_services/get. Schedule day ranges are milliseconds-from-midnight.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const result = await client.get("/control/blocked_services/get");
      return jsonToolResult(result);
    },
  };
}
