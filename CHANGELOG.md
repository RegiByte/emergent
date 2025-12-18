# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-18

### Added

- **Exposed `handleEvent` function** - Pure function that computes effects from events without executing them. Allows testing handler logic in isolation.
  ```typescript
  const effects = loop.handleEvent({ type: "increment" });
  expect(effects).toEqual([{ type: "state:update", count: 1 }]);
  ```

- **Exposed `executeEffects` function** - Async function that executes effects and returns a Promise. Enables waiting for effect completion in tests.
  ```typescript
  const effects = loop.handleEvent({ type: "increment" });
  await loop.executeEffects(effects, { type: "increment" });
  // All effects are now complete
  ```

### Changed

- **Renamed `executor` config parameter to `executors`** - More accurately reflects that it's a map of multiple executor functions. This is a naming consistency improvement.
  ```typescript
  // Before
  createEventLoop({ executor: { ... } })
  
  // After
  createEventLoop({ executors: { ... } })
  ```

- **`dispatch` now composes `handleEvent` and `executeEffects`** - Internal refactor that separates pure computation from side effect execution. The public API remains the same (fire-and-forget), but now you can use the individual functions for better test control.

### Benefits

- **Better testability** - Test pure handler logic separately from side effects
- **Async control** - Wait for effects to complete when needed (tests, debugging)
- **Production convenience** - `dispatch` still works as before (fire-and-forget)
- **Separation of concerns** - Pure vs impure phases are now explicit

### Migration Guide

#### For the `executor` → `executors` rename:

If you're using TypeScript with `satisfies`, update:

```typescript
// Before
const executor = {
  "my-effect": (effect, ctx) => { ... }
} satisfies EffectExecutorMap<Effects, Events, Context>;

// After
const executors = {
  "my-effect": (effect, ctx) => { ... }
} satisfies EffectExecutorMap<Effects, Events, Context>;

createEventLoop({
  // ...
  executors, // instead of executor
});
```

#### For testing with the new API:

**Before (still works):**
```typescript
test("dispatching increment updates state", () => {
  loop.dispatch({ type: "increment" });
  // Executors may not have run yet (async)
});
```

**After (recommended for testing):**
```typescript
test("increment produces correct effects", () => {
  const effects = loop.handleEvent({ type: "increment" });
  expect(effects).toEqual([
    { type: "state:update", count: 1 }
  ]);
});

test("increment updates state", async () => {
  const effects = loop.handleEvent({ type: "increment" });
  await loop.executeEffects(effects, { type: "increment" });
  // All effects are now complete
  expect(currentState.count).toBe(1);
});
```

## [1.0.0] - 2025-12-15

### Added

- Initial release
- Event-driven system with handlers and executors
- Type-safe discriminated unions for events and effects
- Subscription system for observing event flows
- Error handling hooks (`onExecutorError`, `onListenerError`)
- Full TypeScript support with inference
- Helper types: `EventHandlerMap`, `EffectExecutorMap`, `EffectExecutorMapBase`
- Integration support for state management libraries
- Braided resource integration examples

[1.1.0]: https://github.com/RegiByte/emergent/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/RegiByte/emergent/releases/tag/v1.0.0

