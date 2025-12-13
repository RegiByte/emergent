import { useEffect, useState } from "react";

/**
 * THE OBSERVER PATTERN - Timer System
 *
 * This shows the pattern with a more complex system:
 * - Multiple timers managed in a Map
 * - React observes remaining time for specific timers
 * - Polling pattern (checks every 100ms)
 */

type Timer = {
  id: string;
  startedAt: number;
  delayMs: number;
  callback: () => void;
  timeoutId: number;
};

export function createTimerManager() {
  // ============================================
  // SYSTEM STATE (Lives in closure)
  // ============================================
  const timers = new Map<string, Timer>();

  const cancel = (id: string) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      timers.delete(id);
    }
  };

  // ============================================
  // SYSTEM API (Business logic)
  // ============================================
  const schedule = (id: string, delayMs: number, callback: () => void) => {
    // Cancel existing timer with same ID
    if (timers.has(id)) {
      cancel(id);
    }

    // Create timer entry first (before setTimeout callback can fire)
    const startedAt = Date.now();
    const timerEntry: Timer = {
      id,
      startedAt,
      delayMs,
      callback,
      timeoutId: 0, // Placeholder, will be set immediately
    };

    // Schedule new timer
    const timeoutId = window.setTimeout(() => {
      // Only execute if this timer is still the active one
      // (it might have been replaced by a new schedule call)
      const currentTimer = timers.get(id);
      if (currentTimer && currentTimer.timeoutId === timeoutId) {
        // Delete BEFORE calling callback!
        // This way if callback schedules a new timer with same ID,
        // it won't see the old one and try to cancel it
        timers.delete(id);
        callback();
      }
    }, delayMs);

    // Update with actual timeoutId and add to map
    timerEntry.timeoutId = timeoutId;
    timers.set(id, timerEntry);
  };

  const exists = (id: string) => {
    return timers.has(id);
  };

  const cleanup = () => {
    timers.forEach((timer) => clearTimeout(timer.timeoutId));
    timers.clear();
  };

  // ============================================
  // OBSERVATION HOOK (React's window into the system)
  // ============================================
  const useRemainingTime = (id: string, updateIntervalMs = 100) => {
    const [remainingMs, setRemainingMs] = useState<number | null>(null);

    useEffect(() => {
      const updateRemaining = () => {
        // Cross the closure boundary!
        // React is peeking into the timers Map
        const timer = timers.get(id);

        if (!timer) {
          setRemainingMs(null);
          return;
        }

        const elapsed = Date.now() - timer.startedAt;
        const remaining = Math.max(0, timer.delayMs - elapsed);
        setRemainingMs(remaining);
      };

      // Initial update
      updateRemaining();

      // Poll for updates
      const interval = setInterval(updateRemaining, updateIntervalMs);

      return () => clearInterval(interval);
    }, [id, updateIntervalMs]);

    return remainingMs;
  };

  const useTimerExists = (id: string) => {
    const [timerExists, setTimerExists] = useState(exists(id));

    useEffect(() => {
      const interval = setInterval(() => {
        // Cross the closure boundary!
        setTimerExists(timers.has(id));
      }, 100);

      return () => clearInterval(interval);
    }, [id]);

    return timerExists;
  };

  // ============================================
  // RETURN THE SYSTEM
  // ============================================
  return {
    // Business logic (works anywhere)
    schedule,
    cancel,
    exists,
    cleanup,

    // React observation hooks (only work in React)
    useRemainingTime,
    useTimerExists,
  };
}

// ============================================
// SINGLE INSTANCE (Stable reference)
// ============================================
export const timerManager = createTimerManager();
