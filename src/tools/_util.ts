import { Type, Static } from "@sinclair/typebox";
import type { AdGuardClient } from "../adguard-client.ts";
import type { ResolvedConfig } from "../config.ts";
import { getInstanceConfig } from "../config.ts";

export const InstanceArg = Type.Optional(Type.String({
  description: "Named instance to target (e.g. 'primary', 'secondary'). Default: the configured default instance.",
}));

export type ClientFactory = (instance?: string) => AdGuardClient;

export function jsonToolResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function makeClientFactory(cfg: ResolvedConfig, build: (ic: ReturnType<typeof getInstanceConfig>) => AdGuardClient): ClientFactory {
  return (instance) => build(getInstanceConfig(cfg, instance));
}
