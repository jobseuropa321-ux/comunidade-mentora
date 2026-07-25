import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { installStaleBuildGuards } from "./lib/appRecovery";
import "./index.css";

// Pega os erros de build obsoleto que acontecem FORA do render do React
// (preload do Vite, promise solta, <script> que não carregou).
installStaleBuildGuards();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
