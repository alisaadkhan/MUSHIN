import { useCallback, useRef } from "react";

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  onLimitReached?: () => void;
}

export function useRateLimit({ maxAttempts, windowMs, onLimitReached }: RateLimitConfig) {
  const attemptsRef = useRef<number[]>([]);

  const check = useCallback((): boolean => {
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter((t) => now - t < windowMs);

    if (attemptsRef.current.length >= maxAttempts) {
      onLimitReached?.();
      return false;
    }

    attemptsRef.current.push(now);
    return true;
  }, [maxAttempts, windowMs, onLimitReached]);

  const reset = useCallback(() => {
    attemptsRef.current = [];
  }, []);

  return { check, reset };
}
