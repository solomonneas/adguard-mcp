import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const SafeSearchSchema = Type.Optional(Type.Object({
  enabled: Type.Optional(Type.Boolean()),
  bing: Type.Optional(Type.Boolean()),
  duckduckgo: Type.Optional(Type.Boolean()),
  ecosia: Type.Optional(Type.Boolean()),
  google: Type.Optional(Type.Boolean()),
  pixabay: Type.Optional(Type.Boolean()),
  yandex: Type.Optional(Type.Boolean()),
  youtube: Type.Optional(Type.Boolean()),
}, { additionalProperties: false }));

const Schema = Type.Object({
  instance: InstanceArg,
  name: Type.String({ description: "Client display name (must be unique on this instance)." }),
  ids: Type.Array(Type.String(), { minItems: 1, description: "Identifier(s) for this client: IP, MAC, ClientID, or CIDR. At least one required." }),
  use_global_settings: Type.Optional(Type.Boolean()),
  filtering_enabled: Type.Optional(Type.Boolean()),
  safebrowsing_enabled: Type.Optional(Type.Boolean()),
  parental_enabled: Type.Optional(Type.Boolean()),
  safe_search: SafeSearchSchema,
  use_global_blocked_services: Type.Optional(Type.Boolean()),
  blocked_services: Type.Optional(Type.Array(Type.String())),
  blocked_services_schedule: Type.Optional(Type.Object({}, { additionalProperties: true })),
  upstreams: Type.Optional(Type.Array(Type.String())),
  tags: Type.Optional(Type.Array(Type.String())),
  ignore_querylog: Type.Optional(Type.Boolean()),
  ignore_statistics: Type.Optional(Type.Boolean()),
  upstreams_cache_enabled: Type.Optional(Type.Boolean()),
  upstreams_cache_size: Type.Optional(Type.Number()),
  confirm: Type.Boolean({ description: "Must be true. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_add_client";

// Explicit allowlist of AGH Client fields. Any field not in this list (e.g. instance,
// confirm, destructive, or a future gate flag) MUST NOT be forwarded in the request body.
const CLIENT_BODY_FIELDS = [
  "name",
  "ids",
  "use_global_settings",
  "filtering_enabled",
  "safebrowsing_enabled",
  "parental_enabled",
  "safe_search",
  "use_global_blocked_services",
  "blocked_services",
  "blocked_services_schedule",
  "upstreams",
  "tags",
  "ignore_querylog",
  "ignore_statistics",
  "upstreams_cache_enabled",
  "upstreams_cache_size",
] as const;

export function createAdguardAddClientTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: add client",
    description: "Register a new named client via POST /control/clients/add. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const body: Record<string, unknown> = {};
      for (const k of CLIENT_BODY_FIELDS) {
        if (raw[k] !== undefined) body[k] = raw[k];
      }
      const client = getClient(raw.instance as string | undefined);
      await client.post("/control/clients/add", body);
      return jsonToolResult({ added: true, name: body.name });
    },
  };
}
