# Architecture: Emergent + Braided + React Example

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │  Start   │  │   Stop   │  │   Message   │  │   Schedule   │ │
│  │  Button  │  │  Button  │  │   Input     │  │   Button     │ │
│  └────┬─────┘  └────┬─────┘  └──────┬──────┘  └──────┬───────┘ │
└───────┼─────────────┼───────────────┼────────────────┼─────────┘
        │             │               │                │
        ▼             ▼               ▼                ▼
   app:start     app:stop      message:add      message:add
                                (immediate)      (scheduled)
        │             │               │                │
        └─────────────┴───────────────┴────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │         EMERGENT EVENT LOOP                 │
        │  (runtime resource - event dispatcher)      │
        └─────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │              EVENT HANDLERS                 │
        │         (Pure Functions - Rules)            │
        │                                             │
        │  • app:start    → [state:update, timer]    │
        │  • app:stop     → [state:update, cancel]   │
        │  • app:tick     → [state:update, timer]    │
        │  • message:add  → [state:update | timer]   │
        │  • message:scheduled → [state:update]      │
        └─────────────────────────────────────────────┘
                              │
                              ▼
                      [Effects Array]
                      (Data Structure)
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │            EFFECT EXECUTORS                 │
        │       (Side Effects - Actions)              │
        │                                             │
        │  • state:update    → Zustand setState       │
        │  • timer:schedule  → setTimeout + dispatch  │
        │  • timer:cancel    → clearTimeout           │
        │  • log            → console.log             │
        └─────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴───────────────────────┐
        │                     │                       │
        ▼                     ▼                       ▼
   ┌────────┐          ┌──────────┐           ┌──────────┐
   │ Store  │          │  Timer   │           │  Logger  │
   │Resource│          │ Resource │           │ Resource │
   └────┬───┘          └────┬─────┘           └────┬─────┘
        │                   │                       │
        ▼                   ▼                       ▼
   setState()         setTimeout()            console.log()
        │                   │
        │                   └─────► (after delay) ───┐
        │                                            │
        ▼                                            ▼
   ┌─────────────────────────────────────────────────────┐
   │         React Re-render (useSyncExternalStore)      │
   │                                                     │
   │  • Status indicator updates                         │
   │  • Counter increments                               │
   │  • Uptime refreshes                                 │
   │  • Messages appear                                  │
   └─────────────────────────────────────────────────────┘
```

## Resource Dependency Graph

```
┌──────────────────────────────────────────────────────────┐
│                    Braided System                        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  store   │  │  timer   │  │  logger  │              │
│  │          │  │          │  │          │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │              │                    │
│       └─────────────┴──────────────┴──────┐             │
│                                            │             │
│  ┌──────────────────┐  ┌──────────────────┴──┐          │
│  │ eventHandlers    │  │   executors         │          │
│  │  (static)        │  │    (static)         │          │
│  └────────┬─────────┘  └──────────┬──────────┘          │
│           │                       │                     │
│           └───────────┬───────────┘                     │
│                       │                                 │
│                       ▼                                 │
│              ┌─────────────────┐                        │
│              │    runtime      │                        │
│              │  (event loop)   │                        │
│              └─────────────────┘                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  React App      │
              │  (useResource)  │
              └─────────────────┘
```

## Data Flow Example: Starting the System

### 1. User clicks "Start" button

```typescript
onClick={handleStart}
```

### 2. Component dispatches event

```typescript
runtime.dispatch({ type: "app:start" })
```

### 3. Event loop finds handler

```typescript
const handler = handlers["app:start"]
```

### 4. Handler executes (pure function)

```typescript
"app:start": (_state, _event, context) => {
  const now = context.getNow();
  return [
    { type: "state:update", updates: { currentState: "running", startedAt: now } },
    { type: "timer:schedule", id: "app-tick", delayMs: 1000, onExpire: { type: "app:tick" } },
    { type: "log", message: "System started" }
  ];
}
```

### 5. Effects execute sequentially

**Effect 1: state:update**
```typescript
executors["state:update"](effect, context)
  → context.store.setState({ currentState: "running", startedAt: now })
```

**Effect 2: timer:schedule**
```typescript
executors["timer:schedule"](effect, context)
  → context.timer.schedule("app-tick", 1000, () => {
      context.dispatch({ type: "app:tick" })
    })
```

**Effect 3: log**
```typescript
executors["log"](effect, context)
  → context.logger.log("System started")
```

### 6. React re-renders

```typescript
useSyncExternalStore(store.subscribe, store.getState)
  → Component sees new state
  → UI updates: status = "running", startedAt = timestamp
```

### 7. Timer expires (1 second later)

```typescript
setTimeout callback fires
  → context.dispatch({ type: "app:tick" })
  → Handler executes
  → Returns [state:update (count++), timer:schedule (next tick), log]
  → Cycle continues!
```

## Emergence in Action

Notice how **continuous ticking emerges** from simple rules:

1. `app:start` schedules one timer
2. Timer expires → `app:tick` event
3. `app:tick` handler schedules another timer
4. Timer expires → `app:tick` event
5. **Loop continues indefinitely**

No while loop. No setInterval. No state machine. Just:
- Events (data)
- Handlers (pure functions)
- Effects (data)
- Executors (side effects)

**Complex behavior emerges from simple rules.** 🌊

## Type Safety

Every piece is type-checked:

```typescript
type AppEvents = 
  | { type: "app:start" }
  | { type: "app:stop" }
  | { type: "app:tick" }
  | { type: "message:add"; message: string; immediate: boolean }
  | { type: "message:scheduled"; message: string }

type AppEffects =
  | { type: "state:update"; updates: Partial<AppState> }
  | { type: "log"; level?: "info" | "warn" | "error"; message: string }
  | { type: "timer:schedule"; id: string; delayMs: number; onExpire: AppEvents }
  | { type: "timer:cancel"; id: string }
  | { type: "timer:cancelAll" }
```

TypeScript ensures:
- ✅ All events have handlers
- ✅ All effects have executors
- ✅ Event payloads match handler signatures
- ✅ Effect payloads match executor signatures
- ✅ Discriminated unions work perfectly

## Testing Strategy

### Unit Test Handlers (Pure Functions)

```typescript
test("app:start handler", () => {
  const state = { currentState: "idle", count: 0, messages: [], startedAt: null };
  const event = { type: "app:start" };
  const context = { getNow: () => 1234567890 };
  
  const effects = handlers["app:start"](state, event, context);
  
  expect(effects).toEqual([
    { type: "state:update", updates: { currentState: "running", startedAt: 1234567890 } },
    { type: "timer:schedule", id: "app-tick", delayMs: 1000, onExpire: { type: "app:tick" } },
    { type: "log", message: "System started" }
  ]);
});
```

### Integration Test Event Loop

```typescript
test("full tick cycle", () => {
  const system = createTestSystem();
  
  system.dispatch({ type: "app:start" });
  
  expect(system.getState().currentState).toBe("running");
  expect(system.getState().count).toBe(0);
  
  jest.advanceTimersByTime(1000);
  
  expect(system.getState().count).toBe(1);
  
  jest.advanceTimersByTime(1000);
  
  expect(system.getState().count).toBe(2);
});
```

## Philosophy

This architecture embodies:

1. **Data over code** - Events and effects are plain objects
2. **Simple over complex** - Each piece has one job
3. **Pure over impure** - Handlers are pure, executors are isolated
4. **Composable over monolithic** - Resources compose naturally
5. **Observable over opaque** - Every transformation is visible
6. **Testable over magical** - No framework magic, just functions

**Simple rules → Complex behavior → No central governor** 🌊

