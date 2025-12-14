# Refactor: Role-Based System Initialization

**Date:** December 13, 2025  
**Issue:** Both host and player starting same system on app mount  
**Solution:** Lazy initialization based on user-chosen role  
**Status:** ✅ Refactored

---

## 🐛 **The Problem**

### What Was Happening

**On app startup:**
1. System starts immediately in `main.tsx`
2. **Both** host transport and player transport try to initialize
3. Multiple sessions created on backend
4. Player tries to join a session that doesn't exist (wrong session ID)
5. Connection fails

**Terminal logs showed:**
```
[signaling] client connected 6xVFVgn_pyQhRxKMAAAB  ← App loads
[signaling] client connected VyyJmZIVv2lkoQcGAAAD  ← Another connection
[signaling] session 8591 created by EMyT46lOgY9UcGjGAAAJ  ← Host creates session
[signaling] client connected 5gxRDgH7AjQQpAhHAAAL  ← Player connects
```

**Player error:**
```
❌ Connection Failed
Session not found
```

### Root Cause

The system was starting **before** the user chose their role (host or player). Both host and player resources were being initialized simultaneously, creating confusion.

**From Buzzworthy reference**, we learned:
1. Show **StartScreen** first (user chooses role)
2. **Only then** start the system with the chosen role
3. Use lazy initialization

---

## ✅ **The Solution**

### Architecture Change

**Before (❌ Eager):**
```
main.tsx
  ├─ startSystem(config)  ← Starts immediately!
  └─ <SystemBridge>
       └─ <App>
            ├─ <HostScreen>   ← Both use same system
            └─ <PlayerScreen>
```

**After (✅ Lazy):**
```
main.tsx
  └─ <App>  ← No system yet!
       ├─ Home Screen (choose role)
       ├─ <HostScreen>
       │    └─ startSystem(hostConfig)  ← Starts when mounted
       │         └─ <HostSystemBridge>
       └─ <PlayerScreen>
            └─ createPlayerTransport()  ← Starts when mounted
```

### Key Changes

#### 1. **main.tsx** - Remove Eager Initialization

**Before:**
```typescript
const { system } = await startSystem(systemConfig)

createRoot(document.getElementById('root')!).render(
  <SystemBridge system={system}>
    <App />
  </SystemBridge>
)
```

**After:**
```typescript
// Don't start system here - let App decide when based on role!
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

#### 2. **system.ts** - Separate Host and Player Configs

**Before:**
```typescript
export const systemConfig = {
  store: storeResource,
  runtime: runtimeResource,
  transport: transportResource,  // ← Which transport? Host or player?
}
```

**After:**
```typescript
// Host system (creates sessions)
export const hostSystemConfig = {
  store: storeResource,
  runtime: runtimeResource,
  transport: transportResource,  // Host transport
}

// Player system (joins sessions)
export const createPlayerSystemConfig = (config: { sessionId, playerName }) => ({
  store: playerStoreResource,
  runtime: playerRuntimeResource,
  transport: createPlayerTransportResource(config),
})

// Separate hooks
export const { SystemBridge: HostSystemBridge, useResource: useHostResource } =
  createSystemHooks<typeof hostSystemConfig>()
```

#### 3. **HostScreen.tsx** - Lazy System Start

**Before:**
```typescript
export function HostScreen({ onBack }) {
  const store = useResource('store')  // ← System already started
  const runtime = useResource('runtime')
  const transport = useResource('transport')
  // ...
}
```

**After:**
```typescript
// Content component (uses resources)
function HostScreenContent({ onBack }) {
  const store = useHostResource('store')
  const runtime = useHostResource('runtime')
  const transport = useHostResource('transport')
  // ...
}

// Wrapper component (starts system)
export function HostScreen({ onBack }) {
  const [system, setSystem] = useState(null)
  
  useEffect(() => {
    startSystem(hostSystemConfig)
      .then((result) => {
        console.log('[Host] System started')
        setSystem(result)
      })
      .catch(setError)
  }, [])
  
  if (!system) return <Loading />
  
  return (
    <HostSystemBridge system={system.system}>
      <HostScreenContent onBack={onBack} />
    </HostSystemBridge>
  )
}
```

#### 4. **PlayerScreen.tsx** - Stays Simple

Player doesn't need full Braided system since config is dynamic (sessionId/playerName from props). Keeps simple transport initialization:

```typescript
export function PlayerScreen({ sessionId, playerName, onBack }) {
  const [transport, setTransport] = useState(null)
  
  useEffect(() => {
    const playerTransport = createPlayerTransport({
      signalingServerUrl: SIGNALING_SERVER_URL,
      sessionId,
      playerName,
    })
    
    await playerTransport.start()
    setTransport(playerTransport)
  }, [sessionId, playerName])
  
  // ... use transport
}
```

---

## 🎯 **The Flow**

### User Journey

```
1. App loads → Show home screen
   ├─ No system started yet
   └─ User sees "Host Game" and "Join Game" buttons

2. User clicks "Host Game"
   ├─ Navigate to HostScreen
   ├─ HostScreen mounts
   ├─ useEffect runs → startSystem(hostSystemConfig)
   ├─ Host transport creates session on backend
   ├─ System ready → Render content
   └─ Show session code

3. User clicks "Join Game" (different device)
   ├─ Navigate to PlayerScreen
   ├─ PlayerScreen mounts
   ├─ useEffect runs → createPlayerTransport({ sessionId, playerName })
   ├─ Player transport joins existing session
   ├─ WebRTC connection established
   └─ Show game UI
```

### Backend Perspective

```
Before (❌):
[signaling] client connected (app loads)
[signaling] client connected (another connection??)
[signaling] session X created
[signaling] session Y created  ← Multiple sessions!
[signaling] client tries to join session Z  ← Wrong session!

After (✅):
[signaling] client connected (host chooses role)
[signaling] session X created (host creates)
[signaling] client connected (player chooses role)
[signaling] player joins session X  ← Correct session!
[signaling] WebRTC negotiation succeeds
```

---

## 🎓 **Key Learnings**

### 1. **Lazy Initialization is Key**

Don't start systems until you know what you need. In multiplayer apps:
- Host needs different resources than player
- Config is often dynamic (session IDs, player names)
- Starting too early creates confusion

### 2. **Role-Based Systems**

Different roles need different system configurations:
- **Host**: Creates sessions, manages state, broadcasts to players
- **Player**: Joins sessions, receives state, sends intents

Don't try to make one system do both!

### 3. **Braided Shines for Complex Systems**

- **Host**: Perfect for Braided (complex dependencies, lifecycle management)
- **Player**: Can be simpler (just transport, no full system needed)

Use the right tool for the job.

### 4. **Learn from Production Code**

The Buzzworthy reference showed the pattern:
- `StartScreen` → choose role
- `SystemProvider` → lazy initialization
- `acquireSystem(role)` → role-based startup

**Standing on the shoulders of giants.** 🏔️

---

## 📊 **Files Changed**

1. **`main.tsx`**
   - Removed eager system initialization
   - Just renders App (no SystemBridge)

2. **`system.ts`**
   - Split into `hostSystemConfig` and `createPlayerSystemConfig`
   - Separate hooks: `useHostResource` and player hooks
   - Host and player resources are independent

3. **`HostScreen.tsx`**
   - Split into wrapper (starts system) and content (uses resources)
   - Lazy initialization with `useEffect`
   - Shows loading state while system starts

4. **`PlayerScreen.tsx`**
   - Stays simple (no full Braided system)
   - Just creates transport when mounted
   - Dynamic config from props

---

## 🚀 **Testing**

```bash
cd examples/2-multiplayer-buzzer
npm run dev
```

**Expected behavior:**

1. **App loads** → Home screen, no backend connections yet
2. **Click "Host Game"** → Backend shows ONE session created
3. **Click "Join Game"** (different tab) → Player joins that specific session
4. **WebRTC connects** → Data flows, game works!

**Backend logs should show:**
```
[signaling] client connected (host)
[signaling] session ABCD created
[signaling] client connected (player)
[signaling] player joins session ABCD  ← Same session!
```

---

## 💡 **The Pattern**

This is the **lazy initialization pattern** for multiplayer apps:

```typescript
// 1. Show role selection
<StartScreen onChooseRole={setRole} />

// 2. Start system based on role
{role === 'host' && (
  <HostScreen />  // Starts host system on mount
)}

{role === 'player' && (
  <PlayerScreen />  // Starts player system on mount
)}
```

**Benefits:**
- ✅ No wasted resources
- ✅ Clear separation of concerns
- ✅ Correct session targeting
- ✅ Clean backend logs
- ✅ Easier to debug

**The system starts when needed, not before.** ⏰✨

---

**End of Refactor** 🎉

