import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Point all API calls at the backend server.
// In production this is https://anochat-api.fly.dev
// In local dev this is empty string (Vite proxies /api → localhost:8080)
const apiUrl = (import.meta.env.VITE_API_URL as string) ?? "";
setBaseUrl(apiUrl || null);

createRoot(document.getElementById("root")!).render(<App />);
