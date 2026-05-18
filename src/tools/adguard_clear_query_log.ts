import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertDestructive } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  confirm: Type.Boolean({ description: "Must be true. Tier-3 destructive gate." }),
  destructive: Type.Boolean({ description: "Must be true. Tier-3 destructive gate (the query log is gone after this)." }),
}, { additionalProperties: false });

const NAME = "adguard_clear_query_log";

export function createAdguardClearQueryLogTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: clear query log",
    description: "Wipe the AGH DNS query log via POST /control/querylog_clear (underscore endpoint). Tier-3 destructive; requires confirm:true and destructive:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertDestructive(raw, NAME);
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      await client.post("/control/querylog_clear", undefined);
      return jsonToolResult({ cleared: true });
    },
  };
}
