const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const ENV_LEVEL = (import.meta.env.VITE_LOG_LEVEL as string | undefined)?.toUpperCase() as LogLevel | undefined;
const CURRENT_LEVEL: LogLevel =
  ENV_LEVEL && ENV_LEVEL in LOG_LEVELS
    ? ENV_LEVEL
    : import.meta.env.DEV
      ? "DEBUG"
      : "INFO";

function formatMessage(module: string, level: LogLevel, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const base = `[MUSHIN][${ts}][${level}][${module}] ${message}`;
  return data ? `${base}\n${JSON.stringify(data, null, 2)}` : base;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

export const logger = {
  debug(module: string, message: string, data?: unknown) {
    if (!shouldLog("DEBUG")) return;
    console.debug(formatMessage(module, "DEBUG", message, data));
  },
  info(module: string, message: string, data?: unknown) {
    if (!shouldLog("INFO")) return;
    console.info(formatMessage(module, "INFO", message, data));
  },
  warn(module: string, message: string, data?: unknown) {
    if (!shouldLog("WARN")) return;
    console.warn(formatMessage(module, "WARN", message, data));
  },
  error(module: string, message: string, error?: unknown, data?: Record<string, unknown>) {
    if (!shouldLog("ERROR")) return;
    const fullData: Record<string, unknown> = error
      ? { error: error instanceof Error ? error.message : String(error), ...(data || {}) }
      : (data || {});
    console.error(formatMessage(module, "ERROR", message, fullData));
  },
};
