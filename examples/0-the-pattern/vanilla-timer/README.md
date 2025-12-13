# ⏰ Vanilla Timer - The Observer Pattern

**React observing setTimeout - The pattern with real-world complexity.**

## What This Demonstrates

This example shows the Observer Pattern with a more complex system:

1. **Multiple timers** - Managed in a `Map<string, Timer>`
2. **Polling observation** - React checks every 100ms for updates
3. **Real-time countdown** - Watch remaining time tick down
4. **Multiple observers** - Different components watch different timers

## The Pattern

```
┌─────────────────────────────────────────────┐
│  Timer System (Closure)                     │
│  ┌───────────────────────────────────────┐ │
│  │  const timers = new Map()             │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │ "user-timer" → {                │ │ │
│  │  │   startedAt: 1234567890,        │ │ │
│  │  │   delayMs: 5000,                │ │ │
│  │  │   timeoutId: 42                 │ │ │
│  │  │ }                               │ │ │
│  │  └─────────────────────────────────┘ │ │
│  └───────────────────────────────────────┘ │
│         ↑                                   │
│         │ (crosses boundary every 100ms)    │
│         │                                   │
│  ┌───────────────────────────────────────┐ │
│  │  useRemainingTime(id) {               │ │
│  │    setInterval(() => {                │ │
│  │      const timer = timers.get(id);    │ │
│  │      // Calculate remaining time      │ │
│  │    }, 100);                           │ │
│  │  }                                    │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│  React Components (Observers)               │
│  - TimerDisplay (watches "user-timer")      │
│  - TrafficLight (watches "traffic-light")   │
│                                             │
│  Each observes different timers!            │
└─────────────────────────────────────────────┘
```

## Key Code

### The System (timer.ts)

```typescript
export function createTimerManager() {
  // State lives in closure
  const timers = new Map<string, Timer>();

  // Business logic
  const schedule = (id: string, delayMs: number, callback: () => void) => {
    const timeoutId = setTimeout(() => {
      timers.delete(id);
      callback();
    }, delayMs);

    timers.set(id, { id, startedAt: Date.now(), delayMs, timeoutId });
  };

  // React's window into the system (polling pattern)
  const useRemainingTime = (id: string) => {
    const [remainingMs, setRemainingMs] = useState<number | null>(null);

    useEffect(() => {
      const update = () => {
        const timer = timers.get(id); // Cross boundary!
        if (!timer) {
          setRemainingMs(null);
          return;
        }
        const elapsed = Date.now() - timer.startedAt;
        setRemainingMs(Math.max(0, timer.delayMs - elapsed));
      };

      update(); // Initial
      const interval = setInterval(update, 100); // Poll
      return () => clearInterval(interval);
    }, [id]);

    return remainingMs;
  };

  return { schedule, cancel, useRemainingTime };
}

export const timerManager = createTimerManager();
```

### The Observers (App.tsx)

```typescript
function TimerDisplay() {
  // Observe the "user-timer"
  const remainingMs = timerManager.useRemainingTime("user-timer");

  if (remainingMs === null) {
    return <div>No timer running</div>;
  }

  return <div>{(remainingMs / 1000).toFixed(1)}s remaining</div>;
}

function TrafficLight() {
  // Observe the "traffic-light" timer
  const remainingMs = timerManager.useRemainingTime("traffic-light");

  return <div>Next change in: {(remainingMs / 1000).toFixed(1)}s</div>;
}

// Different components, different timers, same system!
```

## Running It

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## What You'll Learn

1. **Managing multiple items** - The Map pattern for multiple timers
2. **Polling vs. subscriptions** - Simple but effective observation
3. **Real-time updates** - Watch state change over time
4. **Practical application** - Traffic light state machine

## The Polling Pattern

This example uses **polling** (checking every 100ms):

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    // Cross the boundary and read state
    const timer = timers.get(id);
    setRemainingMs(calculateRemaining(timer));
  }, 100);
  return () => clearInterval(interval);
}, [id]);
```

**Pros:**

- Dead simple to implement
- Works with any system
- Predictable performance
- 100ms is fast enough for UI

**Cons:**

- Updates even when nothing changed
- Not as efficient as subscriptions

**Alternative:** You could use a subscription pattern (like in vanilla-counter) where the system notifies React only when timers change. Trade-offs!

## The Key Insight

Look at this comment in `timer.ts`:

```typescript
// Cross the closure boundary!
// React is peeking into the timers Map
const timer = timers.get(id);
```

**This is the pattern.** React doesn't own the timers. React observes the timers. The `Map` lives in a closure, and React's hook reaches in to read it.

## Try This

1. **Schedule multiple timers** - Use different IDs, watch them independently
2. **Change the polling interval** - Try 50ms or 500ms, see the difference
3. **Add a subscription pattern** - Notify only when timers change
4. **Add more timer operations** - Pause, resume, extend

## Real-World Applications

This pattern works for:

- **Debouncing/throttling** - Manage timers for input handlers
- **Animations** - Schedule frame updates
- **Polling** - Check server status periodically
- **Countdowns** - E-commerce sales, game timers
- **State machines** - Traffic lights, workflows

## Next Steps

- Compare with `examples/1-state-management-and-time` (same pattern with Emergent)
- See how Braided makes resource management easier
- Read `.regibyte/11-the-observer-pattern.md` for the philosophy

---

**Simple rules. Living systems. React observes. Emergence everywhere.** 🌊
