import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LazySystemBridge } from "braided-react";
import { chatSystemSingleton, SystemBridge } from "./system/system";

chatSystemSingleton.getSystem().then((system) => {
  console.log("System started", system);
});

// Don't start system here - let App decide when based on role!
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazySystemBridge
      SystemBridge={SystemBridge}
      manager={chatSystemSingleton}
      fallback={<div>System initializing...</div>}
    >
      <App />
    </LazySystemBridge>
  </StrictMode>
);
