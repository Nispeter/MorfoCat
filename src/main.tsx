import React from "react";
import ReactDOM from "react-dom/client";
// Must stay above the App import: the stores read localStorage as they are
// evaluated, and this moves what the old app name saved across to the new one.
import "./lib/renameMigration";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
