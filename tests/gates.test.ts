import { describe, it, expect } from "vitest";
import { assertConfirmedWrite, assertDestructive, WriteGateError } from "../src/gates.ts";

describe("assertConfirmedWrite", () => {
  it("passes when confirm is true", () => {
    expect(() => assertConfirmedWrite({ confirm: true }, "adguard_add_user_rule")).not.toThrow();
  });
  it("throws when confirm is missing", () => {
    expect(() => assertConfirmedWrite({}, "adguard_add_user_rule")).toThrow(WriteGateError);
  });
  it("throws when confirm is false", () => {
    expect(() => assertConfirmedWrite({ confirm: false }, "adguard_add_user_rule")).toThrow(WriteGateError);
  });
  it("error message names the tool", () => {
    try { assertConfirmedWrite({}, "adguard_add_user_rule"); }
    catch (e) { expect((e as Error).message).toContain("adguard_add_user_rule"); }
  });
});

describe("assertDestructive", () => {
  it("passes when both confirm and destructive are true", () => {
    expect(() => assertDestructive({ confirm: true, destructive: true }, "adguard_replace_user_rules")).not.toThrow();
  });
  it("throws when destructive is missing", () => {
    expect(() => assertDestructive({ confirm: true }, "adguard_replace_user_rules")).toThrow(WriteGateError);
  });
  it("throws when confirm is missing", () => {
    expect(() => assertDestructive({ destructive: true }, "adguard_replace_user_rules")).toThrow(WriteGateError);
  });
});
