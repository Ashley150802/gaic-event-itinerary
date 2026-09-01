import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "./router";
import { SettingsProvider } from "./lib/settings";
import { App } from "./App";
import "./styles.css";
import "./components/reactbits/reactbits.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root container #root not found");

createRoot(container).render(
  <StrictMode>
    <SettingsProvider>
      <RouterProvider>
        <App />
      </RouterProvider>
    </SettingsProvider>
  </StrictMode>,
);
