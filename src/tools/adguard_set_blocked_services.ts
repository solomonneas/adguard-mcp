import { Type } from "@sinclair/typebox";
import type { ClientFactory } from "./_util.ts";
import { InstanceArg, jsonToolResult, hhmmToMs } from "./_util.ts";
import { assertConfirmedWrite } from "../gates.ts";

const DayRange = Type.Object({
  start: Type.Union([Type.Number(), Type.String()], { description: "Milliseconds from midnight (0-86400000) or HH:MM string." }),
  end: Type.Union([Type.Number(), Type.String()], { description: "Milliseconds from midnight (0-86400000) or HH:MM string." }),
}, { additionalProperties: false });

const ScheduleSchema = Type.Optional(Type.Object({
  time_zone: Type.Optional(Type.String()),
  sun: Type.Optional(DayRange),
  mon: Type.Optional(DayRange),
  tue: Type.Optional(DayRange),
  wed: Type.Optional(DayRange),
  thu: Type.Optional(DayRange),
  fri: Type.Optional(DayRange),
  sat: Type.Optional(DayRange),
}, { additionalProperties: false }));

const Schema = Type.Object({
  instance: InstanceArg,
  ids: Type.Array(Type.String(), { description: "Service IDs from the catalog (youtube, instagram, tiktok, ...). Empty array clears global blocks." }),
  schedule: ScheduleSchema,
  confirm: Type.Boolean({ description: "Must be true. Tier-2 safe-write gate." }),
}, { additionalProperties: false });

const NAME = "adguard_set_blocked_services";

function normalizeSchedule(schedule: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!schedule) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schedule)) {
    if (key === "time_zone") { out[key] = value; continue; }
    if (value && typeof value === "object" && "start" in value && "end" in value) {
      const range = value as { start: string | number; end: string | number };
      out[key] = { start: hhmmToMs(range.start), end: hhmmToMs(range.end) };
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function createAdguardSetBlockedServicesTool(getClient: ClientFactory) {
  return {
    name: NAME,
    label: "adguard: set blocked services",
    description: "Set the GLOBAL blocked-services list and optional weekly schedule via PUT /control/blocked_services/update. Accepts HH:MM strings or milliseconds for schedule times. Tier-2 write; requires confirm:true.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      assertConfirmedWrite(raw, NAME);
      const args = raw as { instance?: string; ids: string[]; schedule?: Record<string, unknown> };
      const client = getClient(args.instance);
      const body: Record<string, unknown> = { ids: args.ids };
      const normalized = normalizeSchedule(args.schedule);
      if (normalized) body.schedule = normalized;
      await client.put("/control/blocked_services/update", body);
      return jsonToolResult({ set: true, count: args.ids.length });
    },
  };
}
