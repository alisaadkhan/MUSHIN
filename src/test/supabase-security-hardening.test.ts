import {
  checkRateLimit,
  consumeNonceOnce,
  isDuplicateWithinWindow,
  isRecentTimestamp,
  isValidTrackingCode,
  resolveAuthorizedWorkspace,
} from "../../supabase/functions/_shared/security";

describe("supabase security hardening", () => {
  it("rejects missing or stale webhook timestamp", () => {
    const now = 1_700_000_000_000;
    expect(isRecentTimestamp(null, now)).toBe(false);
    expect(isRecentTimestamp("not-a-number", now)).toBe(false);
    expect(isRecentTimestamp(String(Math.floor(now / 1000) - 1000), now)).toBe(false);
    expect(isRecentTimestamp(String(Math.floor(now / 1000)), now)).toBe(true);
  });

  it("enforces nonce one-time use", () => {
    const nonceStore = new Map<string, number>();
    const now = 1_700_000_000_000;

    expect(consumeNonceOnce(nonceStore, "nonce-12345678", now)).toBe(true);
    expect(consumeNonceOnce(nonceStore, "nonce-12345678", now + 1000)).toBe(false);
    expect(consumeNonceOnce(nonceStore, "nonce-abcdef12", now + 1000)).toBe(true);
  });

  it("allows only valid tracking code shapes", () => {
    expect(isValidTrackingCode("ABC123XYZ9")).toBe(true);
    expect(isValidTrackingCode("abc123")).toBe(true);
    expect(isValidTrackingCode("a")).toBe(false);
    expect(isValidTrackingCode("bad-code!")) .toBe(false);
  });

  it("rate limits bursts by IP", () => {
    const store = new Map<string, number[]>();
    const now = 1_700_000_000_000;

    expect(checkRateLimit(store, "ip:1", 2, 60_000, now).allowed).toBe(true);
    expect(checkRateLimit(store, "ip:1", 2, 60_000, now + 1).allowed).toBe(true);

    const blocked = checkRateLimit(store, "ip:1", 2, 60_000, now + 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("deduplicates repeated clicks in short window", () => {
    const dedupe = new Map<string, number>();
    const now = 1_700_000_000_000;

    expect(isDuplicateWithinWindow(dedupe, "1.2.3.4:ABC123", 30_000, now)).toBe(false);
    expect(isDuplicateWithinWindow(dedupe, "1.2.3.4:ABC123", 30_000, now + 5000)).toBe(true);
    expect(isDuplicateWithinWindow(dedupe, "1.2.3.4:ABC123", 30_000, now + 31_000)).toBe(false);
  });

  it("resolves workspace only from authorized memberships", () => {
    const memberships = [{ workspace_id: "ws-1" }, { workspace_id: "ws-2" }];

    expect(resolveAuthorizedWorkspace(undefined, memberships)).toBe("ws-1");
    expect(resolveAuthorizedWorkspace("ws-2", memberships)).toBe("ws-2");
    expect(resolveAuthorizedWorkspace("ws-evil", memberships)).toBeNull();
    expect(resolveAuthorizedWorkspace("ws-1", [])).toBeNull();
  });
});
