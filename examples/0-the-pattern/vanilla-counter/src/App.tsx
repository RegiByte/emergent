import { counter } from "./counter";
import "./App.css";

/**
 * COMPONENT 1: Observes and controls the counter
 */
function CounterDisplay() {
  // React observes the system through the hook
  // The hook crosses the closure boundary
  const count = counter.useCount();

  return (
    <div className="card">
      <h2>Counter Display</h2>
      <div className="count-display">{count}</div>
      <div className="button-group">
        <button onClick={counter.decrement}>-1</button>
        <button onClick={counter.reset}>Reset</button>
        <button onClick={counter.increment}>+1</button>
      </div>
    </div>
  );
}

/**
 * COMPONENT 2: Also observes the same counter
 *
 * Key insight: Multiple components can observe the same system
 * without passing props or using Context!
 */
function CounterStats() {
  const count = counter.useCount();

  return (
    <div className="card">
      <h2>Counter Stats</h2>
      <div className="stats">
        <div className="stat">
          <span className="label">Current Value:</span>
          <span className="value">{count}</span>
        </div>
        <div className="stat">
          <span className="label">Is Positive:</span>
          <span className="value">{count > 0 ? "Yes" : "No"}</span>
        </div>
        <div className="stat">
          <span className="label">Is Even:</span>
          <span className="value">{count % 2 === 0 ? "Yes" : "No"}</span>
        </div>
        <div className="stat">
          <span className="label">Absolute Value:</span>
          <span className="value">{Math.abs(count)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * COMPONENT 3: Another observer, showing it works anywhere in the tree
 */
function CounterBadge() {
  const count = counter.useCount();

  return (
    <div className="badge">
      Count: <strong>{count}</strong>
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
        <h1>🌊 The Observer Pattern</h1>
        <p className="subtitle">
          React observing an independent system - No libraries, just closures
        </p>
        <CounterBadge />
      </header>

      <main>
        <div className="grid">
          <CounterDisplay />
          <CounterStats />
        </div>

        <div className="explanation">
          <h3>What's Happening Here?</h3>
          <ol>
            <li>
              <strong>System lives in closure:</strong> The counter state exists
              independently in <code>counter.ts</code>
            </li>
            <li>
              <strong>React observes through hooks:</strong> Components use{" "}
              <code>counter.useCount()</code> to watch the state
            </li>
            <li>
              <strong>Multiple observers:</strong> Three components observe the
              same system without props or Context
            </li>
            <li>
              <strong>Stable reference:</strong> The <code>counter</code> object
              never changes, it's created once
            </li>
          </ol>

          <div className="key-insight">
            <strong>🔑 Key Insight:</strong> React doesn't own the counter.
            React observes the counter. The system lives independently, and
            React just watches through a window.
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
