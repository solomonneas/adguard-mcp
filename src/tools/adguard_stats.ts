import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });

export function createAdguardStatsTool(getClient: ClientFactory) {
  return {
    name: "adguard_stats",
    label: "adguard: stats",
    description: "Get 24h DNS query statistics (totals, blocked %, top blocked domains, top clients) via GET /control/stats.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const stats = await client.get("/control/stats");
      return jsonToolResult(stats);
    },
  };
}
