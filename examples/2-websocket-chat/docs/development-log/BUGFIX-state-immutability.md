# Bug Fix: State Immutability in Transport Layers

**Date:** December 13, 2025  
**Session:** 18  
**Status:** ✅ Fixed

---

## 🐛 **The Bug**

Player screen stuck on "Syncing clock..." even though clock sync completed successfully.

### **Symptoms**

**Player logs showed:**
```
[Player] Clock sync sample: {offset: 24, rtt: 50, ready: true}
```

**But UI still displayed:**
```
Syncing clock...
```

**Expected:**
```
✓ Clock synced
Offset: 24ms
```

---

## 🔍 **Root Cause**

**Two separate but related issues:**

### **Issue 1: Host Transport (Fixed in Previous Session)**

Host was subscribing to wrong observable:
```typescript
// WRONG: Subscribe to Emergent runtime events
runtime.subscribe(() => {
  broadcastSnapshot()
})

// CORRECT: Subscribe to Zustand store state changes
runtime.store.subscribe(() => {
  broadcastSnapshot()
})
```

### **Issue 2: Player Transport (This Fix)**

Player transport was **mutating state** instead of creating new objects:

```typescript
// WRONG: Mutation (same object reference)
state.clockSyncReady = clockSync.isReady()
notify()

// CORRECT: New object (new reference)
state = {
  ...state,
  clockSyncReady: clockSync.isReady(),
}
notify()
```

---

## 💡 **Why This Matters**

React's `useSyncExternalStore` uses **`Object.is()`** for change detection:

```typescript
const state = useSyncExternalStore(
  (callback) => transport?.subscribe(callback) ?? (() => {}),
  () => transport?.getState() ?? null  // ← Returns same object = no re-render!
)
```

**When state is mutated:**
- `Object.is(oldState, newState)` → `true` (same reference)
- React thinks nothing changed
- No re-render
- UI stuck

**When new object is created:**
- `Object.is(oldState, newState)` → `false` (different reference)
- React detects change
- Re-render triggered
- UI updates ✅

---

## ✅ **The Fix**

Changed all state mutations in `transport-player.ts` to create new objects:

### **1. Clock Sync Updates**
```typescript
// Before
state.clockOffset = clockSync.getOffset()
state.clockSyncReady = clockSync.isReady()

// After
state = {
  ...state,
  clockOffset: clockSync.getOffset(),
  clockSyncReady: clockSync.isReady(),
}
```

### **2. Snapshot Updates**
```typescript
// Before
state.snapshot = message.snapshot

// After
state = {
  ...state,
  snapshot: message.snapshot,
}
```

### **3. Connection State Updates**
```typescript
// Before
state.isConnected = true

// After
state = { ...state, isConnected: true }
```

### **4. Session Join Updates**
```typescript
// Before
state.peerId = response.data.peerId
state.hostId = response.data.hostId

// After
state = {
  ...state,
  peerId: response.data.peerId,
  hostId: response.data.hostId,
}
```

---

## 📊 **Files Changed**

1. `transport-host.ts` (line 343-346) - Subscribe to store instead of runtime
2. `transport-player.ts` (multiple locations) - Create new state objects

---

## 🎓 **Key Learning**

**When using `useSyncExternalStore`, the external store MUST return new object references when state changes.**

### **Two Approaches:**

**Approach 1: Use Zustand (Host)**
- Zustand handles immutability automatically
- Built-in shallow comparison
- More features (middleware, devtools)
- Best for complex state

**Approach 2: Manual Immutability (Player)**
- Create new objects with spread operator
- Simpler, no dependencies
- Full control
- Best for simple state

---

## 🧪 **Testing**

**Before Fix:**
- ❌ Player UI stuck on "Syncing clock..."
- ❌ Clock sync status never updates
- ❌ Snapshot never received by UI

**After Fix:**
- ✅ Player UI shows "✓ Clock synced"
- ✅ Clock offset displayed
- ✅ Game state updates in real-time

---

## 🔗 **Related Bugs**

- Bug #1: Infinite update loop (Session 17) - Fixed with Zustand
- Bug #7: State immutability (Session 18) - This fix

**Both bugs share the same root cause:** Improper handling of object references with `useSyncExternalStore`.

---

## 💬 **The Pattern**

This is a fundamental pattern in React:

**React's reconciliation relies on reference equality for performance.**

When using external stores:
1. ✅ Create new objects when state changes
2. ✅ Use immutable update patterns
3. ✅ Let React detect changes via `Object.is()`
4. ❌ Don't mutate objects in place

**This is why Redux, Zustand, and other state libraries enforce immutability!**

---

**End of Bug Fix Documentation**

_"Immutability is not just a best practice. It's a requirement for React's change detection."_ 🎯

