import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const Schema = Type.Object({
  instance: InstanceArg,
  enabled: Type.Boolean({ description: "Target SafeSearch state globally." }),
  bing: Type.Optional(Type.Boolean()),
  duckduckgo: Type.Optional(Type.Boolean()),
  ecosia: Type.Optional(Type.Boolean()),
  google: Type.Optional(Type.Boolean()),
  pixabay: Type.Optional(Type.Boolean()),
  yandex: Type.Optional(Type.Boolean()),
  youtube: Type.Optional(Type.Boolean()),
  confirm: Type.Boolean({ description: "Must be true. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_toggle_safesearch";

export function createAdguardToggleSafesearchTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: toggle safesearch",
    description: "Enable or disable SafeSearch globally via PUT /control/safesearch/settings. Per-engine flags optional (default to all engines when enabling). Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as Record<string, boolean | string | undefined>;
      const enabled = args.enabled as boolean;
      const engines = ["bing", "duckduckgo", "ecosia", "google", "pixabay", "yandex", "youtube"] as const;
      const body: Record<string, boolean> = { enabled };
      // When disabling SafeSearch, every per-engine flag MUST be false regardless of
      // what the caller passed; AGH otherwise interprets explicit per-engine `true`
      // as "keep this engine filtered" which contradicts the user's enabled:false intent.
      for (const e of engines) {
        if (!enabled) body[e] = false;
        else if (args[e] !== undefined) body[e] = args[e] as boolean;
        else body[e] = true;
      }
      const client = getClient(args.instance as string | undefined);
      await client.put("/control/safesearch/settings", body);
      return jsonToolResult({ set: true, enabled });
    },
  };
}
