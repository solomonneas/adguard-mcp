import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";

const Schema = Type.Object({ instance: InstanceArg }, { additionalProperties: false });
const NAME = "adguard_get_safesearch_settings";

export function createAdguardGetSafesearchSettingsTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: get safesearch settings",
    description: "Get SafeSearch enabled state + per-engine flags via GET /control/safesearch/status.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const args = raw as { instance?: string };
      const client = getClient(args.instance);
      const result = await client.get("/control/safesearch/status");
      return jsonToolResult(result);
    },
  };
}
