import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';

export const ProtectedRoute: React.FC = () => {
  const { isConnected, authLoading } = useAlphaContext();

  if (authLoading) {
    // You can render a loading spinner here if you have one
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <p>Loading session...</p>
      </div>
    );
  }

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}; 