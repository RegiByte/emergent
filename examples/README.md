# 🌊 Emergent Examples

**A progressive journey through the Observer Pattern in React**

## The Pattern

> **React doesn't need to own your state. React can observe your state.**

This collection demonstrates a fundamental architectural pattern:

1. **Systems live independently** - State exists in closures, outside React
2. **React observes through hooks** - Hooks cross the closure boundary
3. **Stable references** - Single instances, created once, never change
4. **Multiple observers** - Components watch the same system without props

## Learning Path

### 🎯 Start Here: The Pure Pattern

**No libraries. Just closures + React.**

These examples prove the pattern is fundamental, not library-specific:

#### [0-the-pattern/vanilla-counter](./0-the-pattern/vanilla-counter/)

- **Complexity:** ⭐ Beginner
- **Concepts:** Closures, subscriptions, stable references
- **Time:** 5 minutes
- **You'll learn:** The core pattern in its purest form

#### [0-the-pattern/vanilla-timer](./0-the-pattern/vanilla-timer/)

- **Complexity:** ⭐⭐ Intermediate
- **Concepts:** Multiple timers, polling, real-time updates
- **Time:** 10 minutes
- **You'll learn:** How the pattern scales to complex systems

### 🚀 The Full Stack

**With Emergent + Braided + React**

These examples show how purpose-built libraries make the pattern ergonomic:

#### [1-state-management-and-time](./1-state-management-and-time/)

- **Complexity:** ⭐⭐⭐⭐ Advanced
- **Concepts:** Event-driven architecture, effects, state machines, resource management
- **Time:** 30 minutes
- **You'll learn:** Full-stack application of the pattern

**Note:** This is a complex exploration. Start with vanilla examples first!

## Quick Start

Each example is a standalone Vite project:

```bash
cd examples/0-the-pattern/vanilla-counter
npm install
npm run dev
```

## The Philosophy

### Traditional React (Inside-Out)

```typescript
function Component() {
  const [count, setCount] = useState(0);

  // React owns the state
  // Business logic mixed with rendering
  // Can't reuse outside React

  return <div>{count}</div>;
}
```

### Observer Pattern (Outside-In)

```typescript
// System lives independently
const counter = createCounter(); // Closure

function Component() {
  const count = counter.useCount(); // Observe!

  // React just watches
  // Business logic separated
  // System works anywhere

  return <div>{count}</div>;
}
```

## Why This Matters

### Problems This Solves

1. **Where does business logic live?** → In systems, not components
2. **How do I test complex logic?** → Test systems independently
3. **How do I share state?** → Multiple components observe the same system
4. **How do I integrate external systems?** → Wrap them with observation hooks
5. **How do I avoid useEffect soup?** → Move logic to systems

### Real-World Applications

This pattern works for:

- ✅ Timers and scheduling
- ✅ WebSocket connections
- ✅ Game engines
- ✅ Audio/video players
- ✅ Canvas state
- ✅ Database queries
- ✅ Form validation
- ✅ Theme management
- ✅ Authentication
- ✅ Anything!

## Comparison with Other Patterns

### vs. Redux/Zustand

- **Redux/Zustand:** State in store, actions from components (still React-centric)
- **Observer Pattern:** System manages itself, React just observes

### vs. React Query

- **React Query:** Perfect for server state, uses similar pattern internally
- **Observer Pattern:** Generalizes React Query's approach to all state

### vs. Custom Hooks

- **Custom Hooks:** Reusable React logic, tied to React lifecycle
- **Observer Pattern:** System exists independently, works anywhere

## The Key Insight

Look for this comment in the examples:

```typescript
// Cross the closure boundary!
// React is peeking into the system
const value = systemState.get(id);
```

**This is the pattern.** React doesn't own it. React observes it.

## Further Reading

- [`.regibyte/11-the-observer-pattern.md`](../.regibyte/11-the-observer-pattern.md) - Comprehensive philosophy
- [`.regibyte/12-the-paradigm-shift.md`](../.regibyte/12-the-paradigm-shift.md) - The breakthrough moment
- [Emergent Library](https://github.com/RegiByte/emergent) - Event-driven causality
- [Braided Library](https://github.com/RegiByte/braided) - Resource management

- [ ] TODO: Remove these comments mentioning the .regibyte folder or formalize the documents

## Contributing Examples

Want to add an example? Follow this structure:

1. **Single concept** - Each example teaches one thing
2. **Progressive complexity** - Build on previous examples
3. **Clear README** - Explain what, why, and how
4. **Beautiful UI** - Make it engaging
5. **Comments** - Especially at closure boundaries

## The Vision

> "Imagine if people could really hear this. We can generate hundreds of examples following patterns like this, all well done and explained. It's impossible to ignore, from simple examples to big ones."

This is not just about libraries. **This is a paradigm shift.**

React Query did this for server state. We're doing this for **all state**.

---

**Simple rules. Living systems. React observes. Emergence everywhere.** 🌊

## Quick Reference

| Example            | Complexity | Time  | Key Concept    |
| ------------------ | ---------- | ----- | -------------- |
| vanilla-counter    | ⭐         | 5min  | Pure pattern   |
| vanilla-timer      | ⭐⭐       | 10min | Multiple items |
| 1-state-management | ⭐⭐⭐⭐   | 30min | Full stack     |

**Start with vanilla-counter. It's the foundation for everything else.**
