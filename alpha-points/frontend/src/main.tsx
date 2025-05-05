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
        let message = 'Unknown error';
        let stack = '';
        if (error instanceof Error) {
            message = error.message;
            stack = error.stack || '';
        } else if (typeof error === 'object' && error !== null) {
            message = JSON.stringify(error);
        } else {
            message = String(error);
        }
        rootElement.innerHTML = `
            <h2>Critical Error</h2>
            <pre><strong>Message:</strong> ${message}</pre>
            <pre><strong>Stack:</strong> ${stack || 'No stack trace available.'}</pre>
            <br/>
            <pre><strong>Package ID Env:</strong> ${typeof pkgIdFromEnv !== 'undefined' && pkgIdFromEnv !== null && pkgIdFromEnv !== '' ? pkgIdFromEnv : 'NOT FOUND'}</pre>
        `;
        // Optionally, you could also set a red background for visibility
        rootElement.style.background = '#ffe6e6';
        rootElement.style.color = '#a00';
        rootElement.style.padding = '2rem';
        rootElement.style.fontFamily = 'monospace, monospace';
      }
    }

