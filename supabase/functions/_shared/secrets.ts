declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

type SecretAccessResult = {
  value: string;
  envKey: string;
  version: string;
  isDeprecated: boolean;
};

type SecretVersionSpec = {
  envKey: string;
  version: string;
  deprecated?: boolean;
  deprecationMessage?: string;
};

type SecretOptions = {
  endpoint?: string;
  required?: boolean;
  versions?: SecretVersionSpec[];
};

const DEFAULT_VERSION_SPECS = (logicalName: string): SecretVersionSpec[] => [
  { envKey: `${logicalName}_V2`, version: "v2" },
  {
    envKey: `${logicalName}`,
    version: "v1",
    deprecated: true,
    deprecationMessage: `Use ${logicalName}_V2 and rotate off ${logicalName}.`,
  },
];

function logSecretAccess(event: {
  logicalName: string;
  envKey?: string;
  version?: string;
  endpoint?: string;
  status: "resolved" | "missing";
  warning?: string;
}) {
  console.info(
    JSON.stringify({
      level: "INFO",
      event: "secret_access",
      logical_name: event.logicalName,
      env_key: event.envKey,
      version: event.version,
      endpoint: event.endpoint ?? "unknown",
      status: event.status,
      warning: event.warning,
      ts: new Date().toISOString(),
    }),
  );
}

export function getSecret(logicalName: string, options: SecretOptions = {}): string | null {
  const versions = options.versions ?? DEFAULT_VERSION_SPECS(logicalName);

  for (const spec of versions) {
    const value = Deno.env.get(spec.envKey);
    if (!value) continue;

    const warning = spec.deprecated
      ? spec.deprecationMessage ?? `Secret version ${spec.version} for ${logicalName} is deprecated.`
      : undefined;

    if (warning) {
      console.warn(`[secrets] ${warning}`);
    }

    logSecretAccess({
      logicalName,
      envKey: spec.envKey,
      version: spec.version,
      endpoint: options.endpoint,
      status: "resolved",
      warning,
    });

    return value;
  }

  logSecretAccess({
    logicalName,
    endpoint: options.endpoint,
    status: "missing",
  });

  if (options.required !== false) {
    throw new Error(`Missing required secret: ${logicalName}`);
  }

  return null;
}

export function getSecretWithMeta(logicalName: string, options: SecretOptions = {}): SecretAccessResult | null {
  const versions = options.versions ?? DEFAULT_VERSION_SPECS(logicalName);

  for (const spec of versions) {
    const value = Deno.env.get(spec.envKey);
    if (!value) continue;

    const warning = spec.deprecated
      ? spec.deprecationMessage ?? `Secret version ${spec.version} for ${logicalName} is deprecated.`
      : undefined;

    if (warning) {
      console.warn(`[secrets] ${warning}`);
    }

    logSecretAccess({
      logicalName,
      envKey: spec.envKey,
      version: spec.version,
      endpoint: options.endpoint,
      status: "resolved",
      warning,
    });

    return {
      value,
      envKey: spec.envKey,
      version: spec.version,
      isDeprecated: !!spec.deprecated,
    };
  }

  logSecretAccess({
    logicalName,
    endpoint: options.endpoint,
    status: "missing",
  });

  if (options.required !== false) {
    throw new Error(`Missing required secret: ${logicalName}`);
  }

  return null;
}

const SECRET_KEY_PATTERN = /(secret|api[_-]?key|token|password|private[_-]?key|client[_-]?secret)/i;

export function assertNoSecretsInRequestBody(
  payload: unknown,
  context = "edge-function-request",
): void {
  const queue: Array<{ path: string; value: unknown }> = [{ path: "$", value: payload }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!current.value || typeof current.value !== "object") continue;

    if (Array.isArray(current.value)) {
      current.value.forEach((item, idx) => queue.push({ path: `${current.path}[${idx}]`, value: item }));
      continue;
    }

    for (const [key, value] of Object.entries(current.value as Record<string, unknown>)) {
      const nextPath = `${current.path}.${key}`;
      if (SECRET_KEY_PATTERN.test(key)) {
        console.warn(`[secrets] blocked potential secret in request body at ${nextPath} (${context})`);
        throw new Error("Secrets must not be provided in request body");
      }
      queue.push({ path: nextPath, value });
    }
  }
}
