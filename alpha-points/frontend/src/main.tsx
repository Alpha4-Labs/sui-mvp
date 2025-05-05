console.log("--- main.jsx starting execution ---");
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
console.log("--- Rendering React root ---"); // <--- Maybe add this too

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
