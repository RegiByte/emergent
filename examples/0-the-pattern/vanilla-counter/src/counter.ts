import { useEffect, useState } from "react";

/**
 * THE OBSERVER PATTERN - Pure Implementation
 *
 * This demonstrates the core pattern without any libraries:
 * 1. System lives in a closure (independent of React)
 * 2. React observes through hooks (crossing the boundary)
 * 3. Stable reference (single instance, never changes)
 */

export function createCounter() {
  // ============================================
  // SYSTEM STATE (Lives in closure)
  // ============================================
  let count = 0;
  const listeners = new Set<() => void>();

  // Notify all observers when state changes
  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  // ============================================
  // SYSTEM API (Business logic)
  // ============================================
  const increment = () => {
    count++;
    notify();
  };

  const decrement = () => {
    count--;
    notify();
  };

  const reset = () => {
    count = 0;
    notify();
  };

  const getCount = () => count;

  // ============================================
  // OBSERVATION HOOK (React's window into the system)
  // ============================================
  const useCount = () => {
    const [value, setValue] = useState(count);

    useEffect(() => {
      // Subscribe to changes
      const listener = () => {
        // Cross the closure boundary - read from the system!
        setValue(count);
      };

      listeners.add(listener);

      // Cleanup on unmount
      return () => {
        listeners.delete(listener);
      };
    }, []);

    return value;
  };

  // ============================================
  // RETURN THE SYSTEM
  // ============================================
  return {
    // Business logic (works anywhere - React, Node.js, tests)
    increment,
    decrement,
    reset,
    getCount,

    // React observation hook (only works in React)
    useCount,
  };
}

// ============================================
// SINGLE INSTANCE (Stable reference)
// ============================================
// This is the key: ONE instance, created once, never changes
// Multiple components can observe the same system
export const counter = createCounter();
