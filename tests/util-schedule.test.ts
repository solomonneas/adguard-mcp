import { describe, it, expect } from "vitest";
import { hhmmToMs } from "../src/tools/_util.ts";

describe("hhmmToMs", () => {
  it("passes through numbers unchanged", () => {
    expect(hhmmToMs(0)).toBe(0);
    expect(hhmmToMs(86400000)).toBe(86400000);
    expect(hhmmToMs(45000000)).toBe(45000000);
  });

  it("converts HH:MM strings to milliseconds from midnight", () => {
    expect(hhmmToMs("00:00")).toBe(0);
    expect(hhmmToMs("12:30")).toBe((12 * 60 + 30) * 60 * 1000);
    expect(hhmmToMs("23:59")).toBe((23 * 60 + 59) * 60 * 1000);
    expect(hhmmToMs("9:05")).toBe((9 * 60 + 5) * 60 * 1000);
  });

  it("accepts 24:00 as end-of-day (86400000)", () => {
    expect(hhmmToMs("24:00")).toBe(86400000);
  });

  it("throws on invalid input", () => {
    expect(() => hhmmToMs("25:00")).toThrow();
    expect(() => hhmmToMs("12:60")).toThrow();
    expect(() => hhmmToMs("not-a-time")).toThrow();
    expect(() => hhmmToMs("12")).toThrow();
  });

  it("throws on non-string, non-number inputs", () => {
    // Schema enforces this at the type level, but the helper is exported and may
    // be hit with raw JSON from older clients. Runtime guard must reject anything
    // that isn't string or finite number.
    expect(() => hhmmToMs(null as unknown as string)).toThrow();
    expect(() => hhmmToMs(undefined as unknown as string)).toThrow();
    expect(() => hhmmToMs({} as unknown as string)).toThrow();
    expect(() => hhmmToMs([] as unknown as string)).toThrow();
    expect(() => hhmmToMs(true as unknown as string)).toThrow();
    expect(() => hhmmToMs(NaN as unknown as number)).toThrow();
    expect(() => hhmmToMs(Infinity as unknown as number)).toThrow();
  });
});
