/**
 * Entry point for the UI. This file is referenced directly from index.html.
 * It mounts the DOM, registers the service worker (production only) and starts
 * the application state machine defined in `app.ts`.
 */
import { initApp } from "./app.ts";
import { registerServiceWorker } from "./pwa.ts";
import "./styles.css";

export function mount(): void {
  const appRoot = document.createElement("div");
  appRoot.id = "app";
  document.body.appendChild(appRoot);

  initApp(appRoot);
  registerServiceWorker();
}

mount();
