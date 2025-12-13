# Quick Start Guide

## Installation

```bash
npm install
```

## Running

```bash
npm run dev
```

Open http://localhost:5173

## What You'll See

A beautiful gradient UI with:

### Status Card
- **System Status** indicator (idle/running/stopped)
- **Tick Count** - increments every second when running
- **Uptime** - HH:MM:SS format
- **Start/Stop buttons** - control the system

### Message Form
- **Text input** - type your message
- **Send Immediately** - adds message right away
- **Schedule (3s delay)** - schedules message for 3 seconds later

### Messages List
- All messages with timestamps
- Scrollable list
- Animated entries

## Try This

1. **Click "Start"**
   - Watch the tick count increment
   - See the uptime clock running
   - Status changes to "running" (green)

2. **Add an immediate message**
   - Type "Hello World"
   - Click "Send Immediately"
   - Message appears instantly

3. **Schedule a message**
   - Type "Delayed message"
   - Click "Schedule (3s delay)"
   - Wait 3 seconds
   - Message appears!

4. **Click "Stop"**
   - Tick count stops
   - Status changes to "stopped" (red)
   - Scheduled messages are cancelled

5. **Open DevTools Console**
   - See all the logs
   - Watch events flow through the system
   - Observe the emergence!

## What's Happening Under the Hood

### When you click "Start":

```
User clicks button
  ↓
runtime.dispatch({ type: "app:start" })
  ↓
Handler returns effects:
  - state:update (set running, record start time)
  - timer:schedule (schedule first tick)
  - log (console message)
  ↓
Executors run:
  - Zustand updates state
  - setTimeout schedules callback
  - Console logs
  ↓
React re-renders (useSyncExternalStore)
  ↓
UI updates
  ↓
Timer expires (1 second)
  ↓
Callback fires: dispatch({ type: "app:tick" })
  ↓
Handler returns effects:
  - state:update (increment count)
  - timer:schedule (schedule next tick)
  - log
  ↓
Cycle continues!
```

### When you schedule a message:

```
User types message and clicks "Schedule"
  ↓
runtime.dispatch({ 
  type: "message:add", 
  message: "...", 
  immediate: false 
})
  ↓
Handler returns:
  - timer:schedule (3 second delay)
  - log (message scheduled)
  ↓
Executor schedules timer with callback:
  dispatch({ type: "message:scheduled", message: "..." })
  ↓
3 seconds pass...
  ↓
Timer expires, callback fires
  ↓
Handler returns:
  - state:update (add message to array)
  - log (message delivered)
  ↓
React re-renders
  ↓
Message appears in list!
```

## The Beauty of It

Notice:
- ✅ **No complex state machines** - just events and effects
- ✅ **No manual subscriptions** - Braided manages lifecycle
- ✅ **No prop drilling** - resources available via hooks
- ✅ **No imperative code** - declarative event flow
- ✅ **Fully typed** - TypeScript catches errors
- ✅ **Easy to test** - handlers are pure functions
- ✅ **Easy to reason about** - clear cause and effect

**This is emergence in action.** 🌊

Complex behavior (continuous ticking, scheduled messages, reactive UI) emerges from simple rules (handlers + executors).

## Next Steps

1. **Read the code** - Start with `src/system.ts`
2. **Modify handlers** - Change the tick interval, add new events
3. **Add features** - Pause button? Message editing? Your call!
4. **Read ARCHITECTURE.md** - Deep dive into how it all works

## Learn More

- [Emergent](https://www.npmjs.com/package/emergent) - Event-driven causality
- [Braided](https://github.com/RegiByte/braided) - Resource management
- [Braided React](https://github.com/RegiByte/braided-react) - React integration

---

*Simple rules. Emergent systems. No central governor. Trust the emergence.* 🌊

