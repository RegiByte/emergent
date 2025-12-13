import { useMemo, useRef, useState } from "react";
import { useResource } from "./system";
import { useStore } from "zustand";

type EventFilter =
  | {
      type: "event";
      event: string;
    }
  | {
      type: "effect";
      effect: string;
    }
  | {
      type: "all";
    };

const defaultFilter: EventFilter = {
  type: "all",
};

function App() {
  const runtime = useResource("runtime");
  const store = useResource("store");
  const timerManager = useResource("timer");
  const inputRef = useRef<HTMLInputElement>(null);
  const [messageInput, setMessageInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<EventFilter>(defaultFilter);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(
    new Set()
  );

  // Subscribe to store changes for reactive updates
  const state = useStore(store, (state) => state);
  const { currentState, count, messages, startedAt, eventLog, trafficLight } =
    state;
  const isRunning = currentState === "running";
  const isPaused = currentState === "paused";
  const isStopped = currentState === "stopped";
  // this clock is here to ensure the UI updates when the system is paused (not ticking)
  // so the uptime remains faithful while the system is either running or paused.
  const uiClock = timerManager.useTickingClock(isStopped, 1000);

  // Observe the traffic light timer - crossing the closure boundary!
  const trafficLightRemainingMs =
    timerManager.useRemainingTime("traffic-light");

  const eventTypes = useMemo(() => {
    return Array.from(
      new Set(eventLog.map((entry) => entry.event.type))
    ).sort();
  }, [eventLog]);

  const effectTypes = useMemo(() => {
    return Array.from(
      new Set(eventLog.flatMap((entry) => entry.effects.map((e) => e.type)))
    ).sort();
  }, [eventLog]);

  const filteredEventLog = useMemo(() => {
    if (activeFilter.type === "all") {
      return eventLog;
    }
    if (activeFilter.type === "event") {
      return eventLog.filter(
        (entry) => entry.event.type === activeFilter.event
      );
    }
    if (activeFilter.type === "effect") {
      return eventLog.filter((entry) =>
        entry.effects.some((e) => e.type === activeFilter.effect)
      );
    }
    return eventLog;
  }, [eventLog, activeFilter]);

  const toggleEntry = (timestamp: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        next.add(timestamp);
      }
      return next;
    });
  };

  const clearEventLog = () => {
    store.setState({ eventLog: [] });
    setExpandedEntries(new Set());
  };

  // Helper to render payload in a friendly format
  const renderPayload = (obj: Record<string, any>) => {
    return Object.entries(obj).map(([key, value]) => {
      let displayValue: string;

      if (value === null || value === undefined) {
        displayValue = String(value);
      } else if (typeof value === "object") {
        displayValue = JSON.stringify(value, null, 2);
      } else if (typeof value === "string") {
        displayValue = `"${value}"`;
      } else {
        displayValue = String(value);
      }

      return (
        <div key={key} className="flex gap-2">
          <span className="font-semibold text-slate-700">{key}:</span>
          <span className="text-slate-600 font-mono text-sm break-all">
            {displayValue}
          </span>
        </div>
      );
    });
  };

  const handleStart = () => {
    runtime.dispatch({ type: "app:start" });
  };

  const handlePause = () => {
    runtime.dispatch({ type: "app:pause" });
  };

  const handleResume = () => {
    runtime.dispatch({ type: "app:resume" });
  };

  const handleStop = () => {
    runtime.dispatch({ type: "app:stop" });
  };

  const resetInput = () => {
    setMessageInput("");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  const handleAddMessage = () => {
    if (!messageInput.trim()) return;
    runtime.dispatch({
      type: "message:add",
      message: messageInput,
    });
    resetInput();
  };

  const handleScheduleMessage = () => {
    if (!messageInput.trim()) return;
    runtime.dispatch({
      type: "message:schedule",
      message: messageInput,
      afterMs: 3000,
    });
    resetInput();
  };

  const handleTrafficStart = () => {
    runtime.dispatch({ type: "traffic:start" });
  };

  const handleTrafficStop = () => {
    runtime.dispatch({ type: "traffic:stop" });
  };

  const formatUptime = () => {
    if (!startedAt) return "Not started";
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - startedAt) / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const uptime = useMemo(() => {
    return formatUptime();
  }, [uiClock, startedAt]);

  const getStatusColor = () => {
    switch (currentState) {
      case "running":
        return "bg-emerald-500";
      case "paused":
        return "bg-amber-500";
      case "stopped":
        return "bg-rose-500";
      default:
        return "bg-slate-400";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-800">
            🌊 Emergent System Demo
          </h1>
          <p className="text-slate-600">
            State Management + Time + Event-Driven Architecture + Data Driven
            Composition
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-800">
                  System Status
                </h2>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}
                  ></div>
                  <span className="text-sm uppercase tracking-wider font-medium text-slate-600">
                    {currentState}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-sky-50 rounded-lg p-4 border border-sky-100">
                  <div className="text-sm text-slate-600 mb-1">Tick Count</div>
                  <div className="text-3xl font-bold text-sky-600">{count}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="text-sm text-slate-600 mb-1">
                    System Uptime
                  </div>
                  <div className="text-3xl font-bold text-blue-600 font-mono">
                    {uptime}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleStart}
                  disabled={
                    currentState === "running" || currentState === "paused"
                  }
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  ▶ Start
                </button>
                {isRunning ? (
                  <button
                    onClick={handlePause}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    ⏸ Pause
                  </button>
                ) : isPaused ? (
                  <button
                    onClick={handleResume}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    ▶ Resume
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 bg-slate-300 cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    ⏸ Pause
                  </button>
                )}
                <button
                  onClick={handleStop}
                  disabled={
                    currentState === "idle" || currentState === "stopped"
                  }
                  className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  ⏹ Stop
                </button>
              </div>
            </div>

            {/* Message Form */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                Add Message
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.shiftKey) {
                      handleScheduleMessage();
                      return;
                    }
                    if (e.key === "Enter") {
                      handleAddMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-slate-900"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleAddMessage}
                    disabled={!messageInput.trim()}
                    className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    📨 Send Now
                  </button>
                  <button
                    onClick={handleScheduleMessage}
                    disabled={!messageInput.trim()}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    ⏰ Schedule (3s)
                  </button>
                </div>
              </div>
            </div>

            {/* Messages List */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                Messages ({messages.length})
              </h2>
              <div className="space-y-2 max-h-82 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    No messages yet. Add one above!
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className="bg-slate-50 rounded-lg px-4 py-2 text-sm font-mono text-slate-700 border border-slate-100"
                    >
                      {message}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Traffic Light State Machine */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                🚦 Traffic Light State Machine
              </h2>

              {/* Visual Light */}
              <div className="flex flex-col items-center gap-4 mb-6">
                <div
                  className={`w-32 h-32 rounded-full shadow-lg transition-all duration-300 ${
                    trafficLight.currentColor === "red"
                      ? "bg-red-500 animate-pulse"
                      : trafficLight.currentColor === "yellow"
                      ? "bg-yellow-400 animate-pulse"
                      : trafficLight.currentColor === "green"
                      ? "bg-green-500 animate-pulse"
                      : "bg-slate-300"
                  }`}
                />

                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-800 uppercase">
                    {trafficLight.currentColor}
                  </div>
                  <div className="text-sm text-slate-600 font-mono mt-1">
                    {trafficLight.currentColor !== "off" && (
                      <>
                        Next transition in:{" "}
                        {trafficLightRemainingMs === null
                          ? "—"
                          : `${(trafficLightRemainingMs / 1000).toFixed(1)}s`}
                      </>
                    )}
                    {trafficLight.currentColor === "off" && "—"}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-3">
                <button
                  onClick={handleTrafficStart}
                  disabled={trafficLight.currentColor !== "off"}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  ▶ Start
                </button>
                <button
                  onClick={handleTrafficStop}
                  disabled={trafficLight.currentColor === "off"}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  ⏹ Stop
                </button>
              </div>

              {/* Sequence Info */}
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Sequence
                </div>
                <div className="text-sm text-slate-700 font-mono">
                  🔴 Red (5s) → 🟢 Green (3s) → 🟡 Yellow (2s) → 🔴 Red
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Event Log */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-800">
                  🌊 Event Log
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({filteredEventLog.length}{" "}
                    {activeFilter.type !== "all" ? "filtered" : "total"})
                  </span>
                </h2>
                {eventLog.length > 0 && (
                  <button
                    onClick={clearEventLog}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
                    title="Clear event log"
                  >
                    🗑️ Clear Event Log
                  </button>
                )}
              </div>

              {/* Filter Controls */}
              {eventLog.length > 0 && (
                <div className="mb-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Filter:
                    </span>
                    <button
                      onClick={() => setActiveFilter({ type: "all" })}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        activeFilter.type === "all"
                          ? "bg-slate-700 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All Events
                    </button>
                  </div>

                  {/* Event Type Filters */}
                  {eventTypes.length > 0 && (
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide pt-1">
                        Events:
                      </span>
                      {eventTypes.map((eventType) => (
                        <button
                          key={eventType}
                          onClick={() =>
                            setActiveFilter({ type: "event", event: eventType })
                          }
                          className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-colors ${
                            activeFilter.type === "event" &&
                            activeFilter.event === eventType
                              ? "bg-sky-600 text-white"
                              : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                          }`}
                        >
                          {eventType}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Effect Type Filters */}
                  {effectTypes.length > 0 && (
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide pt-1">
                        Effects:
                      </span>
                      {effectTypes.map((effectType) => (
                        <button
                          key={effectType}
                          onClick={() =>
                            setActiveFilter({
                              type: "effect",
                              effect: effectType,
                            })
                          }
                          className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-colors ${
                            activeFilter.type === "effect" &&
                            activeFilter.effect === effectType
                              ? "bg-blue-600 text-white"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          }`}
                        >
                          {effectType}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Event Log Entries */}
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2">
                {filteredEventLog.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    {eventLog.length === 0
                      ? "No events yet. Interact with the system to see emergence!"
                      : "No events match the current filter."}
                  </div>
                ) : (
                  [...filteredEventLog].reverse().map((entry, index) => {
                    const isExpanded = expandedEntries.has(entry.timestamp);
                    const hasPayload =
                      Object.keys(entry.event).length > 1 ||
                      entry.effects.some((e) => Object.keys(e).length > 1);

                    return (
                      <div
                        key={entry.timestamp}
                        className="bg-linear-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
                      >
                        {/* Header - Always Visible */}
                        <div
                          className={`p-3 ${
                            hasPayload ? "cursor-pointer" : ""
                          }`}
                          onClick={() =>
                            hasPayload && toggleEntry(entry.timestamp)
                          }
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-500">
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </span>
                              {hasPayload && (
                                <span className="text-xs text-slate-400">
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                              )}
                            </div>
                            <span className="text-xs bg-slate-700 text-white px-2 py-1 rounded font-mono font-semibold">
                              #{filteredEventLog.length - index}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {/* Event Type */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                Event:
                              </span>
                              <span className="text-sm font-mono bg-sky-500 text-white px-3 py-1 rounded-lg border border-sky-600 shadow-sm">
                                {entry.event.type}
                              </span>
                            </div>

                            {/* Effect Types */}
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide pt-1">
                                Effects:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {entry.effects.map((effect, i) => (
                                  <span
                                    key={i}
                                    className="text-xs font-mono bg-blue-500 text-white px-2.5 py-1 rounded-lg border border-blue-600 shadow-sm"
                                  >
                                    {effect.type}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Payload Details */}
                        {isExpanded && hasPayload && (
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-slate-200 mt-2">
                            {/* Event Parameters */}
                            {Object.keys(entry.event).length > 1 && (
                              <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
                                <div className="text-xs font-semibold text-sky-800 mb-2 uppercase tracking-wide">
                                  📋 Event Parameters
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  {renderPayload(
                                    Object.fromEntries(
                                      Object.entries(entry.event).filter(
                                        ([k]) => k !== "type"
                                      )
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Effects Payloads */}
                            {entry.effects.some(
                              (e) => Object.keys(e).length > 1
                            ) && (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                  ⚡ Effect Payloads
                                </div>
                                {entry.effects.map((effect, i) => {
                                  const payload = Object.fromEntries(
                                    Object.entries(effect).filter(
                                      ([k]) => k !== "type"
                                    )
                                  );
                                  if (Object.keys(payload).length === 0)
                                    return null;

                                  return (
                                    <div
                                      key={i}
                                      className="bg-blue-50 rounded-lg p-3 border border-blue-100"
                                    >
                                      <div className="text-xs font-semibold text-blue-800 mb-2">
                                        {effect.type}
                                      </div>
                                      <div className="space-y-1.5 text-xs">
                                        {renderPayload(payload)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-8">
          <p>
            Built with{" "}
            <span className="text-sky-600 font-semibold">Emergent</span> +{" "}
            <span className="text-blue-600 font-semibold">Braided</span> +{" "}
            <span className="text-indigo-600 font-semibold">Braided React</span>
          </p>
          <p className="mt-1">
            Simple rules → Complex behavior → No central governor 🌊
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
