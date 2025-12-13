# 🐛 Bug Fix: Traffic Light Timer Race Condition

## The Problem

The traffic light would transition once (red → green) then stop completely. The countdown would disappear from the UI.

**Symptoms:**
- First transition works perfectly
- Subsequent transitions never happen
- Console shows: `checking timer traffic-light undefined`

## The Investigation

We went through three hypotheses before finding the real issue.

### Hypothesis 1: Gap During Transition ❌

**Theory:** Polling hook checks between deletion and creation of timers.

**Attempted fix:** Create timer entry before `setTimeout`.

**Result:** Didn't solve it.

### Hypothesis 2: Old Callback Deleting New Timer ❌

**Theory:** Old timer's callback fires after new timer is scheduled, deleting the new one.

**Attempted fix:** Check if timer still exists before deleting in callback.

**Result:** Made it worse - traffic light stopped after first transition.

### Hypothesis 3: Timer Deleting Itself ✅

**Theory:** Timer callback deletes itself AFTER calling the callback, but the callback schedules a new timer with the same ID, which then gets cancelled.

**This was it!**

## The Root Cause

Here's what was happening:

```typescript
// BUGGY CODE:
const timeoutId = setTimeout(() => {
  callback();        // Step 2: Schedules next timer
  timers.delete(id); // Step 1: But old timer still in Map!
}, delayMs);

timers.set(id, timerEntry);
```

**The deadly flow:**

1. Timer fires → callback starts executing
2. Callback runs: `schedule("traffic-light", ...)` to schedule next color
3. `schedule()` checks: "Is there already a timer with this ID?"
4. **YES!** The old timer (currently firing) is still in the Map
5. `schedule()` calls `cancel(id)` to remove old timer
6. New timer gets created and added
7. Original callback continues: `timers.delete(id)`
8. **Deletes the NEW timer that was just created!**
9. System stops - no more timers

**The logs proved it:**

```
Timer callback firing: {id: 'traffic-light', timeoutId: 22, ...}
Cancelling existing timer: traffic-light  ← Cancelling ourselves!
Checking traffic-light timer: undefined   ← Gone!
```

## The Fix

**Delete BEFORE calling callback:**

```typescript
const timeoutId = setTimeout(() => {
  const currentTimer = timers.get(id);
  if (currentTimer && currentTimer.timeoutId === timeoutId) {
    // Delete BEFORE callback!
    timers.delete(id);
    callback(); // Now callback won't see old timer
  }
}, delayMs);
```

**The correct flow:**

1. Timer fires → callback starts executing
2. **Delete from Map FIRST** (old timer gone)
3. Call callback: `schedule("traffic-light", ...)`
4. `schedule()` checks: "Is there already a timer with this ID?"
5. **NO!** We deleted it first
6. New timer gets created and added
7. System continues happily

## Why This Works

By deleting the timer **before** calling the callback:
- The old timer is gone when callback runs
- Callback can schedule new timer with same ID
- No conflict, no cancellation
- System continues indefinitely

## The Lesson

**Order matters in asynchronous systems:**

When callbacks can trigger new operations with the same identifier:
1. ✅ **Clean up BEFORE side effects** - Delete state before calling callbacks
2. ✅ **Guard against stale callbacks** - Check if timer is still active
3. ✅ **Avoid self-cancellation** - Don't let callbacks see their own state

This is a **perfect teaching moment** about:
- Race conditions in async code
- The importance of operation ordering
- Why subscription patterns can be more reliable than polling
- How subtle timing issues can break systems

## Comparison: Subscription vs Polling

This bug highlights a key difference:

**Subscription Pattern (vanilla-counter):**
```typescript
// System notifies React exactly when state changes
const notify = () => listeners.forEach(fn => fn());
```
- No race conditions
- Immediate updates
- More reliable for rapid state changes

**Polling Pattern (vanilla-timer):**
```typescript
// React checks periodically
setInterval(() => {
  const timer = timers.get(id);
}, 100);
```
- Simple to implement
- Predictable performance
- But requires careful state management

**Both work!** But polling needs more care with timing.

---

**Bug fixed! Traffic light now runs indefinitely with perfect countdown display.** ✅

**Lesson learned: Delete before callback when callbacks can reschedule!** 🎓
