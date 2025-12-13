import { useState } from "react";
import { timerManager } from "./timer";
import "./App.css";

/**
 * COMPONENT 1: Schedule a timer
 */
function TimerScheduler() {
  const [seconds, setSeconds] = useState(5);
  const [message, setMessage] = useState("");

  const handleSchedule = () => {
    const msg = message || `Timer completed after ${seconds}s!`;
    timerManager.schedule("user-timer", seconds * 1000, () => {
      alert(msg);
    });
    setMessage("");
  };

  return (
    <div className="card">
      <h2>Schedule Timer</h2>
      <div className="form">
        <div className="input-group">
          <label>Seconds:</label>
          <input
            type="number"
            min="1"
            max="60"
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>Message:</label>
          <input
            type="text"
            placeholder="Optional alert message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <button onClick={handleSchedule} className="btn-primary">
          ⏰ Schedule Timer
        </button>
      </div>
    </div>
  );
}

/**
 * COMPONENT 2: Observe the timer's remaining time
 *
 * Key insight: This component observes the timer system
 * by crossing the closure boundary through useRemainingTime
 */
function TimerDisplay() {
  // React observes the timer through this hook
  // The hook reaches into the closure and reads the timers Map!
  const remainingMs = timerManager.useRemainingTime("user-timer");
  const exists = timerManager.useTimerExists("user-timer");

  const handleCancel = () => {
    timerManager.cancel("user-timer");
  };

  if (!exists || remainingMs === null) {
    return (
      <div className="card">
        <h2>Timer Status</h2>
        <div className="status-empty">
          <p>No timer running</p>
          <p className="hint">Schedule one above to see it here!</p>
        </div>
      </div>
    );
  }

  const remainingSeconds = (remainingMs / 1000).toFixed(1);
  const progress = 100 - (remainingMs / (remainingMs + 1000)) * 100;

  return (
    <div className="card">
      <h2>Timer Status</h2>
      <div className="timer-display">
        <div className="time-remaining">{remainingSeconds}s</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <button onClick={handleCancel} className="btn-danger">
          ❌ Cancel Timer
        </button>
      </div>
    </div>
  );
}

/**
 * COMPONENT 3: Traffic light demo
 * Shows multiple timers being observed
 */
function TrafficLight() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentColor, setCurrentColor] = useState<"red" | "yellow" | "green">(
    "red"
  );

  const remainingMs = timerManager.useRemainingTime("traffic-light");

  const startTrafficLight = () => {
    setIsRunning(true);
    setCurrentColor("red");
    scheduleNext("red");
  };

  const stopTrafficLight = () => {
    setIsRunning(false);
    timerManager.cancel("traffic-light");
  };

  const scheduleNext = (color: "red" | "yellow" | "green") => {
    const sequence = {
      red: { next: "green" as const, duration: 3000 },
      green: { next: "yellow" as const, duration: 4000 },
      yellow: { next: "red" as const, duration: 1500 },
    };

    const { next, duration } = sequence[color];

    timerManager.schedule("traffic-light", duration, () => {
      setCurrentColor(next);
      scheduleNext(next);
    });
  };

  return (
    <div className="card">
      <h2>🚦 Traffic Light</h2>
      <div className="traffic-light">
        <div
          className={`light ${
            currentColor === "red" && isRunning ? "active red" : ""
          }`}
        />
        <div
          className={`light ${
            currentColor === "yellow" && isRunning ? "active yellow" : ""
          }`}
        />
        <div
          className={`light ${
            currentColor === "green" && isRunning ? "active green" : ""
          }`}
        />
      </div>

      {isRunning && remainingMs !== null && (
        <div className="countdown">
          Next change in: <strong>{(remainingMs / 1000).toFixed(1)}s</strong>
        </div>
      )}

      <div className="button-group">
        {!isRunning ? (
          <button onClick={startTrafficLight} className="btn-success">
            ▶ Start
          </button>
        ) : (
          <button onClick={stopTrafficLight} className="btn-danger">
            ⏹ Stop
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * MAIN APP
 */
function App() {
  return (
    <div className="app">
      <header>
        <h1>⏰ The Observer Pattern - Timers</h1>
        <p className="subtitle">
          React observing setTimeout - No libraries, just closures
        </p>
      </header>

      <main>
        <div className="grid">
          <TimerScheduler />
          <TimerDisplay />
        </div>

        <TrafficLight />

        <div className="explanation">
          <h3>What's Happening Here?</h3>
          <ol>
            <li>
              <strong>Timer system lives in closure:</strong> A{" "}
              <code>Map&lt;string, Timer&gt;</code> holds all active timers
            </li>
            <li>
              <strong>React observes through hooks:</strong>{" "}
              <code>useRemainingTime(id)</code> crosses the boundary to read
              timer state
            </li>
            <li>
              <strong>Polling pattern:</strong> The hook checks every 100ms for
              updates (simple but effective)
            </li>
            <li>
              <strong>Multiple timers:</strong> Both "user-timer" and
              "traffic-light" are managed independently
            </li>
          </ol>

          <div className="key-insight">
            <strong>🔑 Key Insight:</strong> The comment in{" "}
            <code>timer.ts</code> says it all:
            <pre>
              {`// Cross the closure boundary!
// React is peeking into the timers Map
const timer = timers.get(id);`}
            </pre>
            React doesn't own the timers. React observes the timers. The system
            manages itself.
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
