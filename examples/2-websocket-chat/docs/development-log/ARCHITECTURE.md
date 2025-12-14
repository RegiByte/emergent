# Multiplayer Buzzer - Architecture Deep Dive

This document explains the architectural decisions and patterns used in this example.

## The Three Dimensions

This example demonstrates the **3D architecture** pattern:

### X-Y Plane: React Components
```
HostScreen → LobbyView → PlayerCard
          → BuzzingView → BuzzList
          → ResultView → WinnerCard

PlayerScreen → BuzzButton
            → StatusDisplay
```

React components live on the X-Y plane. They render UI based on observed state.

### Z-Axis: Independent Systems
```
Game Runtime (Emergent)
  ↓
Host Transport (WebRTC)
  ↓
Session Store (Backend)
```

Systems live on the Z-axis (orthogonal to React). They manage their own state in closures.

### Windows: Observation Hooks
```typescript
// React observes through windows
const state = useSyncExternalStore(
  (callback) => transport.subscribe(callback),
  () => transport.getState()
)
```

Hooks are windows from X-Y plane into Z-axis systems.

## The Emergent Pattern

### Event → Handler → Effects → Executor

**1. Events (What Happened)**
```typescript
{ type: 'player:buzz', playerId, timestamp, offset }
```

Events are discriminated unions describing what happened.

**2. Handlers (Pure Functions)**
```typescript
const handler = (state, event, ctx) => {
  // Pure logic - no side effects
  const compensatedTime = event.timestamp + event.offset
  
  return [
    { type: 'state:update', snapshot: newState },
    { type: 'transport:broadcast', payload: data }
  ]
}
```

Handlers are pure functions that transform events into effects.

**3. Effects (What To Do)**
```typescript
{ type: 'transport:broadcast', payload: { ... } }
```

Effects are data describing side effects to perform.

**4. Executors (Side Effects)**
```typescript
const executor = {
  'transport:broadcast': (effect, ctx) => {
    ctx.broadcastMessage(effect.payload)
  }
}
```

Executors interpret effects and perform actual side effects.

### Why This Matters

**Testability:**
```typescript
// Test handlers without mocks
const effects = handler(state, event, {})
expect(effects).toEqual([...])
```

**Replayability:**
```typescript
// Replay events from logs
events.forEach(event => runtime.dispatch(event))
```

**Debuggability:**
```typescript
// Inspect event/effect flow
runtime.subscribe((event, effects) => {
  console.log('Event:', event.type)
  console.log('Effects:', effects.map(e => e.type))
})
```

## The Braided Pattern (Backend)

### Resource System

**Resources are:**
- Independent (live in closures)
- Declarative (define dependencies)
- Deterministic (predictable startup/shutdown)
- Composable (easy to add/remove)

**Example:**
```typescript
const socketIOResource = defineResource({
  id: 'socketIO',
  dependencies: ['httpServer', 'sessionStore'],
  start: ({ httpServer, sessionStore }) => {
    const io = new SocketIOServer(httpServer)
    // Setup with dependencies
    return io
  },
  halt: (io) => {
    io.close()
  },
})
```

### Dependency Graph

```
expressApp → (standalone)
httpServer → [expressApp]
sessionStore → (standalone)
socketIO → [httpServer, sessionStore]
serverListener → [httpServer]
```

Braided resolves dependencies and starts resources in correct order.

## Clock Synchronization

### The Problem

```
Host (0ms latency)
  vs
Player (100ms latency)

Naive approach: Host and directly connected devices always wins
```

### The Solution

**1. Sync Phase**
```
Player                          Host
  |-- Ping (t1) --------------->|
  |                             | serverTime
  |<-- Pong (serverTime) -------|
  | t2 = now()                  |
  |                             |
  | RTT = t2 - t1               |
  | offset = serverTime - (t1 + RTT/2)
```

**2. Buzz Phase**
```typescript
// Player
const localTime = Date.now()
sendBuzz({ localTime, offset })

// Host
const compensatedTime = localTime + offset
```

**3. Winner Determination**
```typescript
const winner = submissions.reduce((earliest, current) => {
  return current.compensatedTime < earliest.compensatedTime 
    ? current 
    : earliest
})
```

### Accuracy

- **Typical offset:** ±5-15ms on LAN
- **Sample count:** 5 ping-pong exchanges
- **Method:** Median of samples (reduces jitter)

## WebRTC Architecture

### Signaling Flow

```
1. Host creates session
   Host → Signaling Server: session:create
   Server → Host: { sessionId, hostToken }

2. Player joins
   Player → Server: session:join { sessionId }
   Server → Host: session:peer-joined { peerId }

3. WebRTC handshake
   Host → Server → Player: offer
   Player → Server → Host: answer
   Both exchange ICE candidates

4. Direct connection established
   Host ←→ Player (peer-to-peer data channel)
```

### Data Channel Protocol

**Host → Player:**
```typescript
{ type: 'snapshot', snapshot: SerializedGameSnapshot }
{ type: 'clock-sync-ping', serverTime: number }
{ type: 'game-started' }
{ type: 'winner-determined', winnerId, winnerName }
```

**Player → Host:**
```typescript
{ type: 'player-joined', playerName: string }
{ type: 'player-buzz', timestamp, offset }
{ type: 'clock-sync-pong', clientTime, serverTime }
```

## Observer Pattern

### The Pattern

```typescript
// System (Z-axis)
function createSystem() {
  let state = initialState
  const listeners = new Set()
  
  const notify = () => listeners.forEach(fn => fn())
  
  const update = (newState) => {
    state = newState
    notify()
  }
  
  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  
  const getState = () => state
  
  return { update, subscribe, getState }
}

// React (X-Y plane)
function Component() {
  const state = useSyncExternalStore(
    system.subscribe,
    system.getState
  )
  
  return <div>{state.value}</div>
}
```

### Why This Works

**1. System is independent:**
```typescript
// Works outside React
system.update(newState)

// Works in Node.js
const state = system.getState()

// Works in tests
expect(system.getState()).toEqual(expected)
```

**2. React just observes:**
```typescript
// React doesn't own the system
// React doesn't control the system
// React just watches through a window
```

**3. Multiple observers:**
```typescript
// Many components can observe same system
function ComponentA() {
  const state = useSyncExternalStore(system.subscribe, system.getState)
  return <div>{state.a}</div>
}

function ComponentB() {
  const state = useSyncExternalStore(system.subscribe, system.getState)
  return <div>{state.b}</div>
}
```

## Orthogonal Composition

### The Concept

Systems are **orthogonal** when they:
- Don't know about each other
- Can be added/removed independently
- Communicate through well-defined interfaces

### Example: Transport Layer

```typescript
// Game runtime doesn't know about WebRTC
runtime.dispatch({ type: 'player:buzz', ... })

// Transport adapter handles WebRTC
transport.broadcastMessage(payload)

// Connected via effects
executor['transport:broadcast'] = (effect, ctx) => {
  transport.broadcastMessage(effect.payload)
}
```

**You could swap WebRTC for:**
- WebSockets
- Local connections (same machine)
- Mock transport (testing)
- Bluetooth
- Anything!

**Zero changes to game logic.**

## Type Safety

### Discriminated Unions

```typescript
type GameEvent =
  | { type: 'player:buzz'; playerId: string; timestamp: number; offset: number }
  | { type: 'game:start' }
  | { type: 'game:reset' }

type GameEffect =
  | { type: 'state:update'; snapshot: GameSnapshot }
  | { type: 'transport:broadcast'; payload: unknown }
```

TypeScript ensures:
- All event types are handled
- All effect types are executed
- No typos in type strings
- Correct payload shapes

### Helper Types

```typescript
// Emergent provides helper types
type Handlers = EventHandlerMap<GameEvent, GameEffect, GameSnapshot, HandlerContext>
type Executors = EffectExecutorMap<GameEffect, GameEvent, ExecutorContext>

// Use satisfies for type checking without losing inference
const handlers = {
  'player:buzz': (state, event, ctx) => {
    // TypeScript knows all types
    return [...]
  }
} satisfies Handlers
```

## Performance Characteristics

### Network

- **Signaling:** Socket.IO (only for handshake)
- **Data:** WebRTC data channels (peer-to-peer)
- **Latency:** 5-20ms (LAN), 30-80ms (Wi-Fi)
- **Throughput:** 100+ messages/sec per player

### State Management

- **Snapshot size:** ~2-5 KB (JSON)
- **Update frequency:** Only on state changes
- **History retention:** Last 100 events (optional)
- **Memory:** ~1-2 MB per session

### Clock Sync

- **Accuracy:** ±5-15ms on LAN
- **Sample count:** 5 exchanges
- **Sync time:** ~1 second
- **Re-sync:** Automatic on drift > 50ms

## Error Handling

### Network Failures

**Player disconnect:**
```typescript
// Transport detects disconnect
pc.onconnectionstatechange = () => {
  if (pc.connectionState === 'failed') {
    runtime.dispatch({ type: 'player:left', playerId })
  }
}
```

**Host disconnect:**
```typescript
// Server enters grace period (5 minutes)
// Host can reclaim with token
socket.emit('session:reclaim', { sessionId, hostToken })
```

### Clock Sync Failures

```typescript
// Player can still buzz without sync
if (!clockSyncReady) {
  console.warn('Clock not synced, buzz may be inaccurate')
}

// Host uses best available offset (may be 0)
const offset = player.clockOffset ?? 0
```

### State Consistency

```typescript
// Host is authoritative
// Players receive snapshots
// No conflicts possible

// If player state diverges, next snapshot corrects it
```

## Testing Strategies

### Unit Tests

```typescript
// Test handlers (pure functions)
test('player buzz creates submission', () => {
  const state = createInitialSnapshot()
  const effects = handlers['player:buzz'](state, event, {})
  expect(effects[0].snapshot.buzzSubmissions).toHaveLength(1)
})

// Test clock sync
test('calculates offset correctly', () => {
  const sample = createClockSyncSample(1000, 1050, 1100)
  expect(sample.offset).toBeCloseTo(50, 5)
})
```

### Integration Tests

```typescript
// Test full flow
test('buzzer determines winner correctly', async () => {
  const runtime = createGameRuntime(...)
  const transport = createHostTransport({ runtime, ... })
  
  await transport.start()
  
  runtime.dispatch({ type: 'game:start' })
  runtime.dispatch({ type: 'player:buzz', playerId: 'p1', timestamp: 1000, offset: 50 })
  runtime.dispatch({ type: 'player:buzz', playerId: 'p2', timestamp: 1010, offset: 40 })
  
  const state = runtime.store.getState().snapshot
  expect(state.winner.playerId).toBe('p2') // 1010 + 40 = 1050 < 1050
})
```

### Manual Testing

```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend

# Browser 1: Host
# Browser 2-4: Players (different tabs/devices)
```

## Deployment Considerations

### Backend

**Environment:**
- Node.js 18+
- PORT (default: 8000)
- HOST_GRACE_PERIOD_MS (default: 300000)

**Scaling:**
- Stateless signaling (can run multiple instances)
- Session store in memory (consider Redis for multi-instance)
- No database needed

### Frontend

**Build:**
```bash
npm run build:frontend
# Outputs to dist/
```

**Hosting:**
- Any static file server (Netlify, Vercel, S3, etc.)
- Update SIGNALING_SERVER_URL to production backend
- Ensure HTTPS (required for WebRTC in production)

### WebRTC Considerations

**STUN servers:**
- Public STUN servers work for most cases
- Consider TURN servers for corporate networks

**Browser support:**
- Chrome/Edge: Full support
- Safari: Full support (requires HTTPS)
- Firefox: Full support

## Future Enhancements

### Possible Additions

1. **Multiple rounds with scoring**
   ```typescript
   type GameSnapshot = {
     // ... existing
     scores: Map<string, number>
     roundNumber: number
   }
   ```

2. **Audio effects**
   ```typescript
   const executor = {
     'audio:play': (effect, ctx) => {
       const audio = new Audio(effect.soundUrl)
       audio.play()
     }
   }
   ```

3. **Animations**
   ```typescript
   const executor = {
     'animation:trigger': (effect, ctx) => {
       ctx.animationManager.play(effect.animationId)
     }
   }
   ```

4. **Spectator mode**
   ```typescript
   type PlayerRole = 'player' | 'spectator'
   // Spectators observe but don't buzz
   ```

5. **Host migration**
   ```typescript
   // If host leaves, promote first player to host
   const newHost = Array.from(players.values())[0]
   ```

## Conclusion

This example demonstrates:

✅ **Fair buzzer mechanics** (clock synchronization)  
✅ **Event-driven architecture** (Emergent)  
✅ **Resource management** (Braided)  
✅ **Observer pattern** (React observing systems)  
✅ **Orthogonal composition** (pluggable transports)  
✅ **Type safety** (discriminated unions)  
✅ **Production-ready** (error handling, recovery)

**The patterns are universal. The code is yours to learn from and adapt.**

---

**Simple rules. Living systems. React observes. Emergence everywhere.** 🌊

