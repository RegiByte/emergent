import { LazySystemBridge } from "braided-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SystemBridge, systemManager } from "./system.ts";
import { ErrorBoundary } from "react-error-boundary";

// Bootstrap the system before react even mounts
systemManager.getSystem().then((system) => {
  console.log("System initialized", system);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary
      fallback={<div>Something went wrong while initializing the system</div>}
    >
      <LazySystemBridge
        SystemBridge={SystemBridge}
        fallback={<div>System initializing...</div>}
        manager={systemManager}
      >
        <App />
      </LazySystemBridge>
    </ErrorBoundary>
  </StrictMode>
);
