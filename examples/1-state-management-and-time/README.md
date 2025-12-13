# 🌊 Emergent Example: State Management + Time

A beautiful demonstration of **Emergent**, **Braided**, and **Braided React** working together to create a reactive, event-driven application with time-based effects.

## What This Demonstrates

### The Trinity in Action

1. **Emergent** - Event-driven causality system
   - Events: `app:start`, `app:stop`, `app:tick`, `message:add`, `message:scheduled`
   - Effects: `state:update`, `log`, `timer:schedule`, `timer:cancel`, `timer:cancelAll`
   - Pure handlers transform events into effects
   - Executors perform side effects

2. **Braided** - Resource lifecycle management
   - `timerResource` - Manages setTimeout/clearTimeout
   - `storeResource` - Zustand store for state
   - `loggerResource` - Console logging
   - `runtimeResource` - The event loop itself
   - Automatic dependency resolution and cleanup

3. **Braided React** - React integration
   - `SystemBridge` - Provides resources to components
   - `useResource` - Access resources in components
   - `LazySystemBridge` - Async system initialization

## Features

- ⏱️ **Real-time Timer** - System ticks every second when running
- 📊 **State Management** - Reactive state with Zustand
- 📨 **Immediate Messages** - Add messages instantly
- ⏰ **Scheduled Messages** - Schedule messages with 3-second delay
- 🎨 **Beautiful UI** - Tailwind CSS with gradient backgrounds
- 🔄 **Reactive Updates** - UI updates automatically via `useSyncExternalStore`

## Running the Example

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## The Architecture

```
User Action (UI)
    ↓
Event Dispatch (runtime.dispatch)
    ↓
Handler (Pure Function)
    ↓
Effects Array (Data)
    ↓
Executors (Side Effects)
    ↓
State Update / Timer Schedule / Log
    ↓
UI Re-renders (React)
```

## Key Concepts

### Events are Causes
```typescript
{ type: "app:start" }
{ type: "message:add", message: "Hello", immediate: true }
```

### Effects are Consequences
```typescript
{ type: "state:update", updates: { count: 1 } }
{ type: "timer:schedule", id: "tick", delayMs: 1000, onExpire: {...} }
```

### Handlers are Pure Rules
```typescript
"app:start": (_state, _event, context) => {
  const now = context.getNow();
  return [
    { type: "state:update", updates: { startedAt: now } },
    { type: "timer:schedule", id: "app-tick", delayMs: 1000, ... }
  ];
}
```

### Executors Perform Side Effects
```typescript
"timer:schedule": (effect, context) => {
  context.timer.schedule(effect.id, effect.delayMs, () => {
    context.dispatch(effect.onExpire);
  });
}
```

## Emergence in Action

Watch how complex behavior emerges from simple rules:

1. **Start button** → `app:start` event
2. Handler returns `state:update` + `timer:schedule` effects
3. State updates, timer starts
4. Timer expires → `app:tick` event
5. Handler returns new `state:update` + new `timer:schedule`
6. **Continuous ticking emerges** from simple rules!

No central controller. No complex state machine. Just events → handlers → effects → executors.

## Philosophy

> "Simple rules. Emergent systems. No central governor. Trust the emergence." 🌊

This example embodies the philosophy:
- **Data over code** - Events and effects are data structures
- **Simple over complex** - Each piece does one thing well
- **Composable** - Resources compose naturally
- **Observable** - Watch the system in action
- **Testable** - Pure handlers, isolated executors

## Learn More

- [Emergent](https://github.com/RegiByte/emergent) - Event-driven causality
- [Braided](https://github.com/RegiByte/braided) - Resource management
- [Braided React](https://github.com/RegiByte/braided-react) - React integration
