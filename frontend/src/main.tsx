import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { MissionProvider } from "./context/MissionContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <MissionProvider>
        <App />
      </MissionProvider>
    </BrowserRouter>
  </StrictMode>
);
