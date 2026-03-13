export const WEBHOOK_SKEW_SECONDS = 300;

export function isRecentTimestamp(
  timestampHeader: string | null,
  nowMs: number = Date.now(),
  maxSkewSeconds: number = WEBHOOK_SKEW_SECONDS,
): boolean {
  if (!timestampHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - Math.floor(ts));
  return ageSeconds <= maxSkewSeconds;
}

export function consumeNonceOnce(
  nonceStore: Map<string, number>,
  nonce: string,
  nowMs: number = Date.now(),
  ttlMs: number = 10 * 60 * 1000,
): boolean {
  if (!nonce || nonce.length < 8 || nonce.length > 128) return false;

  for (const [key, expiresAt] of nonceStore.entries()) {
    if (expiresAt <= nowMs) nonceStore.delete(key);
  }

  if (nonceStore.has(nonce)) return false;
  nonceStore.set(nonce, nowMs + ttlMs);
  return true;
}

export function extractClientIp(forwardedFor: string | null): string {
  if (!forwardedFor) return "unknown";
  return forwardedFor.split(",")[0]?.trim() || "unknown";
}

export function isValidTrackingCode(code: string): boolean {
  return /^[a-zA-Z0-9]{6,32}$/.test(code);
}

export function checkRateLimit(
  store: Map<string, number[]>,
  key: string,
  maxHits: number,
  windowMs: number,
  nowMs: number = Date.now(),
): { allowed: boolean; retryAfterSeconds?: number } {
  const hits = store.get(key) ?? [];
  const fresh = hits.filter((t) => nowMs - t < windowMs);
  if (fresh.length >= maxHits) {
    const oldest = fresh[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (nowMs - oldest)) / 1000));
    store.set(key, fresh);
    return { allowed: false, retryAfterSeconds };
  }
  fresh.push(nowMs);
  store.set(key, fresh);
  return { allowed: true };
}

export function isDuplicateWithinWindow(
  store: Map<string, number>,
  key: string,
  windowMs: number,
  nowMs: number = Date.now(),
): boolean {
  for (const [k, t] of store.entries()) {
    if (nowMs - t > windowMs) store.delete(k);
  }
  const prev = store.get(key);
  if (prev && nowMs - prev <= windowMs) return true;
  store.set(key, nowMs);
  return false;
}

export function resolveAuthorizedWorkspace(
  requestedWorkspaceId: string | null | undefined,
  memberships: Array<{ workspace_id: string }>,
): string | null {
  if (!memberships.length) return null;
  if (!requestedWorkspaceId) return memberships[0].workspace_id;
  return memberships.some((m) => m.workspace_id === requestedWorkspaceId)
    ? requestedWorkspaceId
    : null;
}
