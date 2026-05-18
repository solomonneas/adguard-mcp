import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  enabled: Type.Boolean({ description: "Target SafeBrowsing state." }),
  confirm: Type.Boolean({ description: "Must be true. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_toggle_safebrowsing";

export function createAdguardToggleSafebrowsingTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: toggle safebrowsing",
    description: "Enable or disable AGH SafeBrowsing via POST /control/safebrowsing/enable or /disable. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; enabled: boolean };
      const client = getClient(args.instance);
      const path = args.enabled ? "/control/safebrowsing/enable" : "/control/safebrowsing/disable";
      await client.post(path, undefined);
      return jsonToolResult({ set: true, enabled: args.enabled });
    },
  };
}
