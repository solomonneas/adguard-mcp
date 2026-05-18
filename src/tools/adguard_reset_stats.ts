import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertDestructive } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  confirm: Type.Boolean({ description: "Must be true. Tier-3 destructive gate." }),
  destructive: Type.Boolean({ description: "Must be true. Tier-3 destructive gate (stats history is zeroed)." }),
}, { additionalProperties: false });

const NAME = "adguard_reset_stats";

export function createAdguardResetStatsTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: reset stats",
    description: "Zero out the AGH stats window via POST /control/stats_reset (underscore endpoint). Tier-3 destructive; requires confirm:true and destructive:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertDestructive(raw, NAME);
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      await client.post("/control/stats_reset", undefined);
      return jsonToolResult({ reset: true });
    },
  };
}
