import { useState, useEffect, useCallback } from "react";

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours (IT Rules 2026 — Telecom Cyber Security)
const WARN_BEFORE_MS = 10 * 60 * 1000; // warn 10 minutes before expiry
const SESSION_START_KEY = "sessionStartAt";

export function recordSessionStart() {
  sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
}

export function useSessionExpiry(onExpire: () => void) {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [isExpiring, setIsExpiring] = useState(false);

  const check = useCallback(() => {
    const raw = sessionStorage.getItem(SESSION_START_KEY);
    if (!raw) return;

    const startAt = parseInt(raw, 10);
    const elapsed = Date.now() - startAt;
    const remaining = SESSION_DURATION_MS - elapsed;

    if (remaining <= 0) {
      onExpire();
      return;
    }

    const minsLeft = Math.ceil(remaining / 60000);
    setMinutesLeft(minsLeft);
    setIsExpiring(remaining <= WARN_BEFORE_MS);
  }, [onExpire]);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000); // check every 30 seconds
    return () => clearInterval(interval);
  }, [check]);

  return { minutesLeft, isExpiring };
}
