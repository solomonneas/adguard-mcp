import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  host: Type.String({ description: "Hostname to test (e.g. 'youtube.com'). The lookup runs through AGH's filter pipeline as if the client queried it." }),
  client: Type.Optional(Type.String({ description: "Optional client IP/ClientID/name to simulate the lookup against (per-client rules differ)." })),
  qtype: Type.Optional(Type.String({ description: "DNS query type (A, AAAA, HTTPS, MX...). Default: server-side default (A)." })),
}, { additionalProperties: false });

const NAME = "adguard_check_host";

export function createAdguardCheckHostTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: check host",
    description: "Test what AGH would do with a hostname via GET /control/filtering/check_host. Returns the filter decision, matched rules, CNAME chain, and IPs.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string; host: string; client?: string; qtype?: string };
      const client = getClient(args.instance);
      const params = new URLSearchParams({ name: args.host });
      if (args.client) params.set("client", args.client);
      if (args.qtype) params.set("qtype", args.qtype);
      const result = await client.get(`/control/filtering/check_host?${params.toString()}`);
      return jsonToolResult(result);
    },
  };
}
