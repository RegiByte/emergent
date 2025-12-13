# 🌊 Vanilla Counter - The Observer Pattern

**The purest demonstration of the Observer Pattern in React - no libraries, just closures.**

## What This Demonstrates

This example proves the Observer Pattern is **not library-specific**. It's a fundamental architectural pattern based on:

1. **Closures** - State lives in a closure, independent of React
2. **Stable references** - Single instance, created once, never changes
3. **Boundary crossing** - React hooks reach into the closure to observe state
4. **Multiple observers** - Many components watch the same system without props

## The Pattern

```
┌─────────────────────────────────────┐
│  System (Closure)                   │
│  ┌─────────────────────────────┐   │
│  │  let count = 0              │   │
│  │  const listeners = new Set()│   │
│  └─────────────────────────────┘   │
│         ↑                           │
│         │ (crosses boundary)        │
│         │                           │
│  ┌─────────────────────────────┐   │
│  │  useCount() {               │   │
│  │    // reads count from      │   │
│  │    // closure above!        │   │
│  │  }                          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  React Components (Observers)       │
│  - CounterDisplay                   │
│  - CounterStats                     │
│  - CounterBadge                     │
│                                     │
│  All observe the same system!       │
└─────────────────────────────────────┘
```

## Key Code

### The System (counter.ts)

```typescript
export function createCounter() {
  // State lives in closure
  let count = 0;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((fn) => fn());

  // Business logic
  const increment = () => {
    count++;
    notify();
  };

  // React's window into the system
  const useCount = () => {
    const [value, setValue] = useState(count);

    useEffect(() => {
      const listener = () => setValue(count); // Cross boundary!
      listeners.add(listener);
      return () => listeners.delete(listener);
    }, []);

    return value;
  };

  return { increment, decrement, reset, useCount };
}

// Single instance - stable reference
export const counter = createCounter();
```

### The Observers (App.tsx)

```typescript
function CounterDisplay() {
  const count = counter.useCount(); // Observing!
  return <div>{count}</div>;
}

function CounterStats() {
  const count = counter.useCount(); // Also observing!
  return <div>Is even: {count % 2 === 0}</div>;
}

// No props passed between them!
// No Context needed!
// They both observe the same system.
```

## Running It

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## What You'll Learn

1. **React doesn't need to own state** - The counter lives independently
2. **Hooks can cross closure boundaries** - `useCount()` reads from the closure
3. **Multiple observers work naturally** - No prop drilling, no Context
4. **The pattern is simple** - Just closures + subscriptions + React hooks

## The Key Insight

> **React doesn't own the counter. React observes the counter.**

The `counter` object exists in its own closure. React components observe it through the `useCount()` hook. The hook crosses the closure boundary to read the state.

This is **not magic**. This is **JavaScript closures** + **React hooks**.

## Try This

1. **Add another observer** - Create a new component that uses `counter.useCount()`
2. **Test outside React** - Call `counter.increment()` from the browser console
3. **Add more state** - Track history, add undo/redo
4. **Change the notification pattern** - Try polling instead of subscriptions

## Why This Matters

This pattern works for **everything**:

- Timers
- WebSockets
- Game engines
- Audio players
- Canvas state
- Database queries
- Anything!

**No libraries needed.** Just closures, stable references, and observation hooks.

## Next Steps

- See `vanilla-timer` for a more complex example with `setTimeout`
- See `examples/2-simple-counter` for the same pattern with Emergent library
- Read `.regibyte/11-the-observer-pattern.md` for the full philosophy

---

**Simple rules. Living systems. React observes. Emergence everywhere.** 🌊
