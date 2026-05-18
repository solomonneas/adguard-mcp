import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });
const NAME = "adguard_get_dns_config";

export function createAdguardGetDnsConfigTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: get DNS config",
    description: "Get the DNS server config via GET /control/dns_info (upstreams, bootstrap, cache, parallel resolution, blocking mode, etc).",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const result = await client.get("/control/dns_info");
      return jsonToolResult(result);
    },
  };
}
