import { describe, it, expect } from "vitest";
import { resolveInstances, getInstanceConfig, UnknownInstanceError, NoInstancesError } from "../src/config.ts";

describe("resolveInstances", () => {
  it("parses a single primary instance", () => {
    const env = {
      ADGUARD_PRIMARY_URL: "http://192.0.2.60",
      ADGUARD_PRIMARY_USERNAME: "example-user",
      ADGUARD_PRIMARY_PASSWORD: "secret",
    };
    const cfg = resolveInstances(env);
    expect(cfg.instances.primary).toEqual({
      url: "http://192.0.2.60",
      username: "example-user",
      password: "secret",
    });
    expect(cfg.defaultInstance).toBe("primary");
  });

  it("parses multiple instances", () => {
    const env = {
      ADGUARD_PRIMARY_URL: "http://192.0.2.60",
      ADGUARD_PRIMARY_USERNAME: "u1",
      ADGUARD_PRIMARY_PASSWORD: "p1",
      ADGUARD_SECONDARY_URL: "http://192.0.2.62",
      ADGUARD_SECONDARY_USERNAME: "u2",
      ADGUARD_SECONDARY_PASSWORD: "p2",
    };
    const cfg = resolveInstances(env);
    expect(Object.keys(cfg.instances).sort()).toEqual(["primary", "secondary"]);
  });

  it("respects ADGUARD_DEFAULT_INSTANCE", () => {
    const env = {
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      ADGUARD_PRIMARY_PASSWORD: "p",
      ADGUARD_SECONDARY_URL: "http://y",
      ADGUARD_SECONDARY_USERNAME: "u",
      ADGUARD_SECONDARY_PASSWORD: "p",
      ADGUARD_DEFAULT_INSTANCE: "secondary",
    };
    expect(resolveInstances(env).defaultInstance).toBe("secondary");
  });

  it("throws NoInstancesError when no ADGUARD_*_URL is set", () => {
    expect(() => resolveInstances({})).toThrow(NoInstancesError);
  });

  it("skips partial instances missing url/username/password", () => {
    const env = {
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      // missing password
      ADGUARD_SECONDARY_URL: "http://y",
      ADGUARD_SECONDARY_USERNAME: "u",
      ADGUARD_SECONDARY_PASSWORD: "p",
    };
    const cfg = resolveInstances(env);
    expect(Object.keys(cfg.instances)).toEqual(["secondary"]);
  });
});

describe("getInstanceConfig", () => {
  it("resolves a named instance", () => {
    const cfg = resolveInstances({
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      ADGUARD_PRIMARY_PASSWORD: "p",
    });
    expect(getInstanceConfig(cfg, "primary").url).toBe("http://x");
  });

  it("falls back to default when name omitted", () => {
    const cfg = resolveInstances({
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      ADGUARD_PRIMARY_PASSWORD: "p",
    });
    expect(getInstanceConfig(cfg).url).toBe("http://x");
  });

  it("throws UnknownInstanceError on bad name", () => {
    const cfg = resolveInstances({
      ADGUARD_PRIMARY_URL: "http://x",
      ADGUARD_PRIMARY_USERNAME: "u",
      ADGUARD_PRIMARY_PASSWORD: "p",
    });
    expect(() => getInstanceConfig(cfg, "tertiary")).toThrow(UnknownInstanceError);
  });
});
