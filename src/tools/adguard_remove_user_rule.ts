import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  rule: Type.String({ description: "Exact-match rule line to remove from user_rules." }),
  confirm: Type.Boolean({ description: "Must be true to write. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_remove_user_rule";

export function createAdguardRemoveUserRuleTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: remove user rule",
    description: "Remove an exact-match rule from the AdGuard user-rules block. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; rule: string };
      const client = getClient(args.instance);
      const status = await client.get<{ user_rules: string[] }>("/control/filtering/status");
      const existing = status.user_rules ?? [];
      if (!existing.includes(args.rule)) {
        return jsonToolResult({ removed: null, not_found: true, rules_count: existing.length });
      }
      const next = existing.filter((r) => r !== args.rule);
      await client.post("/control/filtering/set_rules", { rules: next });
      return jsonToolResult({ removed: args.rule, not_found: false, rules_count: next.length });
    },
  };
}
