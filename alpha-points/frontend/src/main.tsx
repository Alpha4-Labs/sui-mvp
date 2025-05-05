// /frontend/src/main.tsx
console.log("--- main.jsx starting execution ---"); // Keep this canary log
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Attempt to access an env var early
const pkgIdFromEnv = import.meta.env.VITE_PACKAGE_ID;
console.log("--- VITE_PACKAGE_ID:", pkgIdFromEnv); // Keep this log

try {
    console.log("--- Entering try block ---");
    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error("Root element #root not found");
    console.log("--- Found root element, creating root ---");
    const root = ReactDOM.createRoot(rootElement);
    console.log("--- Rendering React root ---");
    root.render(
      <React.StrictMode>
        {/* Your providers likely wrap App here */}
        <App />
      </React.StrictMode>,
    );
    console.log("--- React render call finished ---");
} catch (error) {
    console.error("--- CRITICAL RENDER ERROR ---:", error);
    // Display error directly on the page
    const rootElement = document.getElementById('root');
    if (rootElement) {
        rootElement.innerHTML = `<h2>Critical Error</h2><pre>Message: ${error.message}</pre><pre>Stack: ${error.stack}</pre><br/>Package ID Env: ${pkgIdFromEnv || 'NOT FOUND'}`;
    }
}