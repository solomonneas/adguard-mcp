export interface InstanceConfig {
  url: string;
  username: string;
  password: string;
}

export interface ResolvedConfig {
  instances: Record<string, InstanceConfig>;
  defaultInstance: string;
}

export class NoInstancesError extends Error {
  constructor() {
    super("No AdGuard instances configured. Set ADGUARD_<NAME>_URL/USERNAME/PASSWORD for at least one instance.");
    this.name = "NoInstancesError";
  }
}

export class UnknownInstanceError extends Error {
  constructor(name: string, known: string[]) {
    super(`Unknown AdGuard instance: ${name}. Known: ${known.join(", ") || "(none)"}.`);
    this.name = "UnknownInstanceError";
  }
}

const URL_RE = /^ADGUARD_([A-Z0-9_]+)_URL$/;

export function resolveInstances(env: Record<string, string | undefined>): ResolvedConfig {
  const instances: Record<string, InstanceConfig> = {};
  for (const key of Object.keys(env)) {
    const m = URL_RE.exec(key);
    if (!m) continue;
    const upperName = m[1];
    const name = upperName.toLowerCase();
    const url = env[`ADGUARD_${upperName}_URL`];
    const username = env[`ADGUARD_${upperName}_USERNAME`];
    const password = env[`ADGUARD_${upperName}_PASSWORD`];
    if (!url || !username || !password) continue;
    instances[name] = { url, username, password };
  }
  if (Object.keys(instances).length === 0) throw new NoInstancesError();
  const explicitDefault = env.ADGUARD_DEFAULT_INSTANCE?.toLowerCase();
  const defaultInstance = explicitDefault && instances[explicitDefault]
    ? explicitDefault
    : (instances.primary ? "primary" : Object.keys(instances).sort()[0]);
  return { instances, defaultInstance };
}

export function getInstanceConfig(cfg: ResolvedConfig, name?: string): InstanceConfig {
  const resolved = (name ?? cfg.defaultInstance).toLowerCase();
  const inst = cfg.instances[resolved];
  if (!inst) throw new UnknownInstanceError(resolved, Object.keys(cfg.instances));
  return inst;
}
