# Bug Fix: Infinite Update Loop in HostScreen

**Date:** December 13, 2025  
**Issue:** React infinite update loop when using `useSyncExternalStore`  
**Status:** ✅ Fixed

---

## 🐛 **The Problem**

When clicking "Create Session" in the multiplayer buzzer, React threw:

```
Warning: The result of getSnapshot should be cached to avoid an infinite loop
Error: Maximum update depth exceeded
```

### Root Cause

The `getSnapshot` functions in `useSyncExternalStore` were returning **new objects on every call**:

```typescript
// ❌ BAD: Creates new object every time
() => system?.runtime.store.getState().snapshot ?? createInitialSnapshot()
```

React's `useSyncExternalStore` uses `Object.is()` to compare snapshots. New objects = infinite re-renders.

---

## ✅ **The Solution**

Implemented the **Zustand Store Pattern** from the Buzzworthy reference implementation:

### 1. **Added Zustand Vanilla Store**

```typescript
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'

export type RuntimeStore = {
  snapshot: GameSnapshot
}

export const createRuntimeStore = () =>
  createStore<RuntimeStore>()(() => ({
    snapshot: createInitialSnapshot(),
  }))
```

**Why Zustand?**
- ✅ Returns **stable references** (same object when unchanged)
- ✅ Built-in subscription system
- ✅ Tiny (~1KB), framework-agnostic
- ✅ Battle-tested in production (Buzzworthy)
- ✅ Lives in closure space (Z-axis philosophy intact)

### 2. **Updated Runtime to Accept Store**

```typescript
export function createGameRuntime(config: CreateGameRuntimeConfig) {
  const { store, broadcastMessage, sendMessage, onClockSync } = config
  const executor = createExecutor()

  const loop = emergentSystem<...>()({
    getState: () => store.getState().snapshot,
    handlers,
    executor,
    handlerContext: {},
    executorContext: {
      store,
      broadcastMessage,
      sendMessage,
      onClockSync,
    },
  })

  return {
    store,
    dispatch: loop.dispatch,
    subscribe: loop.subscribe,
    dispose: loop.dispose,
  }
}
```

### 3. **Updated Executor to Handle State Updates**

```typescript
export const createExecutor = () => ({
  'state:update': (effect, ctx) => {
    // Update the Zustand store with the new snapshot
    ctx.store.setState({ snapshot: effect.snapshot })
  },
  // ... other executors
})
```

**Key insight:** The executor now explicitly updates the store, making state flow visible and debuggable.

### 4. **Updated HostScreen to Use Zustand's useStore**

```typescript
import { useStore } from 'zustand'

// ✅ GOOD: Zustand caches snapshots, returns stable references
const gameState = system 
  ? useStore(system.runtime.store, (state) => state.snapshot) 
  : createInitialSnapshot()
```

**Why this works:**
- Zustand's `useStore` internally uses `useSyncExternalStore` correctly
- Returns same reference when snapshot hasn't changed
- No manual subscription management needed

---

## 🎯 **Files Changed**

1. **`runtime.ts`**
   - Added Zustand store types and factory
   - Updated `createGameRuntime` to accept store config
   - Made executor a factory function
   - Properly wired `state:update` effect to store

2. **`HostScreen.tsx`**
   - Replaced `useSyncExternalStore` with Zustand's `useStore`
   - Simplified initialization logic
   - Removed circular reference issues

3. **`transport-host.ts`**
   - No changes needed (already accessing `runtime.store` correctly)

---

## 🧪 **Testing**

```bash
cd examples/2-multiplayer-buzzer
npm run dev
```

Open http://localhost:3000 and click "Create Session"

**Expected:** 
- ✅ No infinite loop errors
- ✅ Session created successfully
- ✅ Session code displayed
- ✅ Ready to accept player connections

---

## 📚 **Key Learnings**

### 1. **useSyncExternalStore Requires Stable References**

React compares snapshots with `Object.is()`. If `getSnapshot()` returns a new object every time, React triggers infinite updates.

### 2. **Zustand Solves This Elegantly**

Zustand's store caches state and only returns new references when state actually changes. Perfect for `useSyncExternalStore`.

### 3. **The Pattern is Framework-Agnostic**

Using `zustand/vanilla` (not the React version) keeps the store in closure space (Z-axis). React observes through `useStore`, but the store works without React.

### 4. **Explicit State Updates**

Making the executor explicitly call `store.setState()` makes state flow visible and debuggable. No magic, just clear causality.

---

## 🌊 **The Observer Pattern Intact**

This fix **strengthens** the observer pattern:

```
         React Tree (X-Y plane)
         ┌─────────────┐
         │  Component  │
         │      ↓      │
         │  useStore() │ ← Window to Z-axis
         └─────────────┘
              ↕ (observes)
    ═══════════════════════════
         Closure Space (Z-axis)
         ┌─────────────┐
         │ Zustand     │
         │ Store       │
         │   (State)   │
         └─────────────┘
              ↕
         ┌─────────────┐
         │  Runtime    │
         │ (Emergent)  │
         └─────────────┘
```

- Store lives in closure (Z-axis)
- React observes through `useStore` (window)
- Runtime dispatches events (orthogonal)
- Transport handles network (orthogonal)

**Everything is orthogonal. Everything is observable. Everything emerges.** 🚀

---

## 🎓 **Reference**

This solution was inspired by the Buzzworthy reference implementation at `.regibyte/buzzworthy-ref/game/runtime/core.ts`, which uses the same Zustand pattern for production-grade state management.

**The pattern works. The proof is in production.** ✨

