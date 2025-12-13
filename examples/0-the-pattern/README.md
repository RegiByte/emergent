# 🌊 The Observer Pattern - Pure Examples

**No libraries. Just closures + React. Proof that the pattern is fundamental.**

## Why These Examples Exist

Before showing you how our libraries (Emergent, Braided) make this pattern ergonomic, we need to prove something:

> **The Observer Pattern is not library-specific. It's a fundamental architectural pattern based on JavaScript closures.**

These examples use **zero libraries** (except React itself). They demonstrate the core pattern in its purest form.

## The Examples

### [vanilla-counter](./vanilla-counter/)
**The simplest possible demonstration**

- Single counter in a closure
- Subscription-based observation
- Multiple components observing
- **Start here!**

### [vanilla-timer](./vanilla-timer/)
**A more complex system**

- Multiple timers in a Map
- Polling-based observation
- Real-time countdown
- Traffic light state machine

## The Core Pattern

Every example follows the same structure:

```typescript
// 1. Create a system in a closure
export function createSystem() {
  // State lives here (independent of React)
  const state = { /* ... */ };
  
  // Business logic (works anywhere)
  const doSomething = () => { /* ... */ };
  
  // Observation hook (React's window)
  const useObservableState = () => {
    const [value, setValue] = useState(state.value);
    
    useEffect(() => {
      // Cross the closure boundary!
      // React is peeking into the closure
      const update = () => setValue(state.value);
      
      // Subscribe or poll for updates
      const cleanup = subscribe(update);
      return cleanup;
    }, []);
    
    return value;
  };
  
  return { doSomething, useObservableState };
}

// 2. Create a single instance (stable reference)
export const system = createSystem();

// 3. Components observe
function Component() {
  const value = system.useObservableState();
  return <div>{value}</div>;
}
```

## Key Concepts

### 1. Closures
State lives in a closure, created once, accessible through the returned object.

```typescript
function createCounter() {
  let count = 0; // This lives in the closure
  
  return {
    increment: () => count++,
    getCount: () => count
  };
}
```

### 2. Stable References
The system is created once and never changes. React can safely reference it.

```typescript
// Created once, at module load
export const counter = createCounter();

// Always the same reference
function Component() {
  counter.increment(); // Safe!
}
```

### 3. Boundary Crossing
React hooks reach into the closure to read state.

```typescript
const useCount = () => {
  const [value, setValue] = useState(count);
  
  useEffect(() => {
    // This crosses the boundary!
    // We're reading 'count' from the closure above
    const update = () => setValue(count);
    // ...
  }, []);
  
  return value;
};
```

### 4. Observation Patterns

**Subscription (vanilla-counter):**
```typescript
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

// System notifies observers when state changes
const increment = () => {
  count++;
  notify(); // Tell React to update
};
```

**Polling (vanilla-timer):**
```typescript
// React checks periodically
useEffect(() => {
  const interval = setInterval(() => {
    const timer = timers.get(id); // Read from closure
    setRemainingMs(calculateRemaining(timer));
  }, 100);
  return () => clearInterval(interval);
}, [id]);
```

## What You'll Learn

### From vanilla-counter:
- ✅ The pattern in its simplest form
- ✅ Subscription-based observation
- ✅ Multiple components observing one system
- ✅ No props, no Context needed

### From vanilla-timer:
- ✅ Managing multiple items (Map pattern)
- ✅ Polling-based observation
- ✅ Real-time updates
- ✅ Practical state machines

## The Philosophy

### Traditional React
```
Component owns state
    ↓
Business logic in component
    ↓
Hard to test
    ↓
Hard to reuse
    ↓
useEffect soup
```

### Observer Pattern
```
System owns state (closure)
    ↓
Business logic in system
    ↓
Easy to test (no React needed)
    ↓
Easy to reuse (works anywhere)
    ↓
React just observes
```

## Why No Libraries?

We want to prove that:

1. **The pattern is fundamental** - Not tied to any library
2. **It's based on closures** - Standard JavaScript feature
3. **It's simple** - You could implement it yourself
4. **Libraries add ergonomics** - But the pattern works without them

After you understand these examples, you'll appreciate what Emergent and Braided provide:
- **Emergent:** Event-driven causality (events → effects)
- **Braided:** Resource lifecycle management
- **Braided React:** React integration helpers

But the **core pattern** is what you see here. Pure. Simple. Fundamental.

## Try This

1. **Start with vanilla-counter** (5 minutes)
2. **Then vanilla-timer** (10 minutes)
3. **Then compare with example 1** (see how libraries help)

## The Key Insight

Look for comments like this in the code:

```typescript
// Cross the closure boundary!
// React is peeking into the system
const value = systemState.get(id);
```

**This is the pattern.** React doesn't own the system. React observes the system.

---

**Simple rules. Living systems. React observes. Emergence everywhere.** 🌊

## Next Steps

After these examples, check out:
- [`examples/1-state-management-and-time`](../1-state-management-and-time/) - Same pattern with full stack
- [`.regibyte/11-the-observer-pattern.md`](../../.regibyte/11-the-observer-pattern.md) - The philosophy
- [`.regibyte/12-the-paradigm-shift.md`](../../.regibyte/12-the-paradigm-shift.md) - The breakthrough

