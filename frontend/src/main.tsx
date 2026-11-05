import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./auth/AuthContext";
import { PreferencesProvider } from "./preferences/PreferencesContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><PreferencesProvider><AuthProvider><BrowserRouter><App /></BrowserRouter></AuthProvider></PreferencesProvider></React.StrictMode>,
);
