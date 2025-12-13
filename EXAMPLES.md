# 🌊 Examples - Start Here!

**Learn the Observer Pattern through progressive examples**

## Quick Start

```bash
# The simplest example - start here!
cd examples/0-the-pattern/vanilla-counter
npm install
npm run dev
```

Open http://localhost:5173 and watch React observe an independent system.

## Learning Path

### 1️⃣ Vanilla Counter (5 minutes)
**The pattern in its purest form**

```bash
cd examples/0-the-pattern/vanilla-counter
npm install && npm run dev
```

**You'll learn:**
- State lives in closures (independent of React)
- Hooks cross the closure boundary to observe
- Multiple components watch the same system
- No props, no Context needed

### 2️⃣ Vanilla Timer (10 minutes)
**A more complex system**

```bash
cd examples/0-the-pattern/vanilla-timer
npm install && npm run dev
```

**You'll learn:**
- Managing multiple items (Map pattern)
- Polling vs subscription observation
- Real-time updates
- Practical state machines (traffic light)

### 3️⃣ Full Stack Demo (30 minutes)
**With Emergent + Braided + React**

```bash
cd examples/1-state-management-and-time
npm install && npm run dev
```

**You'll learn:**
- Event-driven architecture
- Effect executors
- Resource management
- Complete application

## The Pattern

```
┌─────────────────────────────────────┐
│  System (Closure)                   │
│  ┌─────────────────────────────┐   │
│  │  let count = 0              │   │
│  └─────────────────────────────┘   │
│         ↑                           │
│         │ (crosses boundary)        │
│         │                           │
│  ┌─────────────────────────────┐   │
│  │  useCount() {               │   │
│  │    // reads count           │   │
│  │  }                          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  React (Observer)                   │
│  - Just renders what it sees        │
│  - Doesn't own the system           │
└─────────────────────────────────────┘
```

## Key Insight

> **React doesn't need to own your state. React can observe your state.**

Traditional React:
```typescript
function Component() {
  const [count, setCount] = useState(0); // React owns it
  return <div>{count}</div>;
}
```

Observer Pattern:
```typescript
const counter = createCounter(); // Lives independently

function Component() {
  const count = counter.useCount(); // React observes it
  return <div>{count}</div>;
}
```

## Why This Matters

### Problems This Solves
- ❌ useEffect soup → ✅ Clean observation
- ❌ Business logic in components → ✅ Separated systems
- ❌ Hard to test → ✅ Test systems independently
- ❌ Hard to share state → ✅ Multiple observers
- ❌ Awkward integrations → ✅ Natural wrappers

### Real-World Applications
- Timers and scheduling
- WebSocket connections
- Game engines
- Audio/video players
- Canvas state
- Database queries
- Form validation
- Theme management
- Authentication
- **Anything!**

## Documentation

- [`examples/README.md`](./examples/README.md) - Full learning path
- [`examples/0-the-pattern/README.md`](./examples/0-the-pattern/README.md) - Why vanilla examples
- [`.regibyte/11-the-observer-pattern.md`](./.regibyte/11-the-observer-pattern.md) - Complete philosophy
- [`.regibyte/12-the-paradigm-shift.md`](./.regibyte/12-the-paradigm-shift.md) - The breakthrough

## The Philosophy

From [`.regibyte/11-the-observer-pattern.md`](./.regibyte/11-the-observer-pattern.md):

> "Where does this `timers` come from? It comes from the resource manager, which exists in the scope of the system. React is observing it, from outside."

**This is the pattern.** React doesn't own the system. React observes the system.

## Next Steps

1. **Run vanilla-counter** (5 min) - Understand the core pattern
2. **Run vanilla-timer** (10 min) - See it scale to complexity
3. **Read the philosophy** (20 min) - Understand why it matters
4. **Run full stack demo** (30 min) - See it in production
5. **Build your own** - Apply the pattern to your problems

---

**Simple rules. Living systems. React observes. Emergence everywhere.** 🌊

**Start with vanilla-counter. Everything else builds on that foundation.**

