import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startBootstrapPrefetch } from "./lib/bootstrap";

// Start downloading the planner data while the screen is still being built.
startBootstrapPrefetch();

// Register service worker for PWA + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
