// src/App.jsx
import React from 'react';
import { SuiProvider } from './context/SuiContext';
import AppContent from './components/AppContent';

/**
 * Main App component - Wraps the entire application with providers
 * This top-level component remains very simple and only handles provider wrapping
 */
function App() {
  return (
    <SuiProvider>
      <AppContent />
    </SuiProvider>
  );
}

export default App;