# Braided Refactor: System Lifecycle Outside React

**Date:** December 13, 2025  
**Issue:** Conditional hooks + system initialization inside React  
**Solution:** Use Braided for proper resource lifecycle management  
**Status:** ✅ Refactored

---

## 🎯 **The Problem**

### Issue 1: Conditional Hook Rendering

```typescript
// ❌ BAD: Hook only runs when system is not null
const gameState = system 
  ? useStore(system.runtime.store, (state) => state.snapshot) 
  : createInitialSnapshot()
```

**Error:** `Rendered more hooks than during the previous render`

React's Rules of Hooks require hooks to be called in the same order every render. Conditional hooks break this rule.

### Issue 2: System Initialization Inside React

```typescript
// ❌ BAD: System created inside useEffect
useEffect(() => {
  const store = createRuntimeStore()
  const runtime = createGameRuntime({ store })
  const transport = createHostTransport({ runtime })
  await transport.start()
  setSystem({ runtime, transport })
}, [])
```

**Problems:**
- StrictMode re-runs effects → double initialization
- Component remounts → connections lost
- Cleanup timing issues
- Race conditions on unmount

---

## ✅ **The Solution: Braided**

[Braided](https://github.com/RegiByte/braided) and [Braided React](https://github.com/RegiByte/braided-react) solve this by managing system lifecycle **outside** React.

### Key Principles:

1. **System starts BEFORE React mounts**
2. **Resources outlive component lifecycles**
3. **React observes, doesn't own**
4. **Dependency-aware startup/shutdown**

---

## 🏗️ **Implementation**

### 1. Define System Resources (`system.ts`)

```typescript
import { defineResource } from 'braided'
import { createSystemHooks } from 'braided-react'

// Store resource
const storeResource = defineResource({
  id: 'store',
  start: () => createRuntimeStore(),
  halt: (store) => console.log('[System] Store halted'),
})

// Runtime resource (depends on store)
const runtimeResource = defineResource({
  id: 'runtime',
  dependencies: ['store'],
  start: ({ store }) => {
    let transport = null
    const runtime = createGameRuntime({
      store,
      broadcastMessage: (payload) => transport?.broadcastMessage(payload),
      sendMessage: (playerId, payload) => transport?.sendMessage(playerId, payload),
      onClockSync: (playerId) => transport?.onClockSync(playerId),
    })
    return {
      ...runtime,
      _wireTransport: (t) => { transport = t },
    }
  },
  halt: (runtime) => runtime.dispose(),
})

// Transport resource (depends on runtime)
const transportResource = defineResource({
  id: 'transport',
  dependencies: ['runtime'],
  start: async ({ runtime }) => {
    const transport = createHostTransport({ runtime, signalingServerUrl: '...' })
    runtime._wireTransport(transport)
    await transport.start()
    return transport
  },
  halt: (transport) => transport.dispose(),
})

export const systemConfig = {
  store: storeResource,
  runtime: runtimeResource,
  transport: transportResource,
}

// Create typed hooks
export const { SystemBridge, useResource } = createSystemHooks<typeof systemConfig>()
```

### 2. Start System Before React (`main.tsx`)

```typescript
import { startSystem } from 'braided'
import { SystemBridge, systemConfig } from './system'

// ✅ GOOD: Start system BEFORE React mounts
const { system } = await startSystem(systemConfig)

console.log('[Main] System started, mounting React...')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemBridge system={system}>
      <App />
    </SystemBridge>
  </StrictMode>
)
```

**Key insight:** System is fully initialized and connected before React even starts. No race conditions, no double initialization.

### 3. Use Resources in Components (`HostScreen.tsx`)

```typescript
import { useResource } from './system'
import { useStore } from 'zustand'

export function HostScreen({ onBack }: HostScreenProps) {
  // ✅ GOOD: Resources already started, hooks always called
  const store = useResource('store')
  const runtime = useResource('runtime')
  const transport = useResource('transport')

  // Subscribe to transport state
  const [transportState, setTransportState] = useState(transport.getState())
  
  useEffect(() => {
    setTransportState(transport.getState())
    return transport.subscribe(() => {
      setTransportState(transport.getState())
    })
  }, [transport])

  // Subscribe to game state (Zustand)
  const gameState = useStore(store, (state) => state.snapshot)

  const handleStartGame = () => {
    runtime.dispatch({ type: 'game:start' })
  }

  // ... render UI
}
```

**Benefits:**
- ✅ No conditional hooks (resources always available)
- ✅ No initialization logic in component
- ✅ StrictMode safe (system already started)
- ✅ Remount safe (resources persist)
- ✅ Clean, simple component code

---

## 🌊 **The Architecture**

```
┌─────────────────────────────────────────┐
│  System Lifecycle (Outside React)      │
│                                         │
│  startSystem(config)                    │
│    ↓                                    │
│  1. Start 'store' (no deps)            │
│  2. Start 'runtime' (needs store)      │
│  3. Start 'transport' (needs runtime)  │
│                                         │
│  System ready ✓                         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  React Mounts                           │
│                                         │
│  <SystemBridge system={system}>        │
│    <App />                              │
│      <HostScreen />                     │
│        useResource('store')    ← observes
│        useResource('runtime')  ← observes
│        useResource('transport')← observes
│  </SystemBridge>                        │
└─────────────────────────────────────────┘
```

**Key insight:** React observes a system that's already running. React doesn't create it, doesn't own it, just observes it.

---

## 📊 **Comparison**

### Before (System Inside React)

```typescript
// ❌ Problems:
useEffect(() => {
  const system = await createSystem()  // Async initialization
  setSystem(system)                    // Triggers re-render
}, [])                                 // Runs twice in StrictMode

if (!system) return <Loading />        // Conditional rendering
const state = system ? useStore(...) : initial  // Conditional hooks ❌
```

**Issues:**
- Conditional hooks (breaks Rules of Hooks)
- Double initialization (StrictMode)
- Cleanup timing issues
- Race conditions

### After (System Outside React with Braided)

```typescript
// ✅ Solution:
// In main.tsx (before React)
const { system } = await startSystem(config)

// In component
const store = useResource('store')     // Always available
const state = useStore(store, s => s)  // Always called ✅
```

**Benefits:**
- No conditional hooks
- Single initialization
- Clean lifecycle
- No race conditions

---

## 🎓 **Key Learnings**

### 1. **React's Rules of Hooks Are Strict**

Hooks must be called:
- In the same order every render
- At the top level (no conditionals)
- In React functions only

Conditional hooks (`system ? useStore(...) : default`) violate these rules.

### 2. **System Initialization Doesn't Belong in React**

Long-lived, stateful resources (WebSockets, game loops, audio contexts) should live **outside** React's lifecycle:

- They outlive component mounts/unmounts
- They survive StrictMode double-renders
- They're independent of React's rendering

### 3. **Braided Solves This Elegantly**

Braided provides:
- Declarative resource definitions
- Dependency-aware startup
- Deterministic lifecycle
- Type-safe dependency injection
- React integration that respects React's rules

### 4. **The Observer Pattern Wins Again**

```
System (Z-axis, closure space)
  ↕ (observes)
React (X-Y plane, component tree)
```

React observes the system through hooks. System lives independently. Orthogonal composition. **The pattern we've been building all along.** ✨

---

## 🚀 **Testing**

```bash
cd examples/2-multiplayer-buzzer
npm run dev
```

**Expected behavior:**
1. Console shows: `[Main] System started, mounting React...`
2. System resources start in order (store → runtime → transport)
3. React mounts with system already ready
4. No hook ordering errors
5. StrictMode double-render doesn't break anything
6. Component remounts don't lose connections

---

## 📚 **References**

- [Braided](https://github.com/RegiByte/braided) - Core system composition library
- [Braided React](https://github.com/RegiByte/braided-react) - React integration
- [React Rules of Hooks](https://reactjs.org/link/rules-of-hooks)
- [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)

---

## 🎯 **Files Changed**

1. **`frontend/src/system.ts`** (NEW)
   - Defines all system resources
   - Creates typed hooks
   - Exports SystemBridge

2. **`frontend/src/main.tsx`**
   - Starts system before React mounts
   - Wraps App in SystemBridge

3. **`frontend/src/HostScreen.tsx`**
   - Removed all initialization logic
   - Uses `useResource()` hooks
   - Clean, simple component

---

## 💡 **The Braided Philosophy**

> **"React observes, doesn't own. System lifecycle is independent."**

This is the same philosophy we've been building:
- Everything is information processing
- Simple rules compose
- Emergence is reliable
- No central governor needed
- **React is an observer, not the governor**

Braided embodies this philosophy for system lifecycle management. It's the missing piece for building production-grade React applications with complex, long-lived resources.

**The Z-axis was always there. Braided makes it explicit.** 🧶✨

---

**End of Refactor** 🚀

