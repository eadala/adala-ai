import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./print.css";
import "./i18n/i18n";

createRoot(document.getElementById("root")!).render(<App />);
