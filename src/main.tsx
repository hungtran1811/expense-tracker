import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { AuthProvider } from "./app/AuthProvider";
import { ToastProvider } from "./shared/ui/Toast";
import { ConfirmProvider } from "./shared/ui/ConfirmDialog";
import { ServiceWorkerUpdate } from "./shared/ui/ServiceWorkerUpdate";
import { shouldRegisterServiceWorker } from "./shared/lib/platform";
import "./styles/app.css";

if (shouldRegisterServiceWorker()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("htf:sw-update"));
            }
          });
        });
      })
      .catch((err) => {
        console.warn("SW register failed", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfirmProvider>
        <AuthProvider>
          <ToastProvider>
            <ServiceWorkerUpdate />
            <App />
          </ToastProvider>
        </AuthProvider>
      </ConfirmProvider>
    </BrowserRouter>
  </StrictMode>
);
