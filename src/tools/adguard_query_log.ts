import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, description: "Max entries to return. Default 50." })),
  client: Type.Optional(Type.String({ description: "Filter by client IP or hostname (AGH uses 'search')." })),
  domain: Type.Optional(Type.String({ description: "Filter by domain." })),
  blocked_only: Type.Optional(Type.Boolean({ description: "When true, only return blocked queries (AGH response_status=blocked)." })),
}, { additionalProperties: false });

export function createAdguardQueryLogTool(getClient: ClientFactory) {
  return {
    name: "adguard_query_log",
    label: "adguard: query log",
    description: "Read recent DNS queries via GET /control/querylog. Filter by client, domain, blocked-only.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string; limit?: number; client?: string; domain?: string; blocked_only?: boolean };
      const params = new URLSearchParams();
      params.set("limit", String(args.limit ?? 50));
      if (args.blocked_only) params.set("response_status", "blocked");
      if (args.client) params.set("search", args.client);
      if (args.domain) params.set("domain", args.domain);
      const client = getClient(args.instance);
      const log = await client.get(`/control/querylog?${params.toString()}`);
      return jsonToolResult(log);
    },
  };
}
