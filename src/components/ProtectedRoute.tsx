import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';
import neonLogoVideo from '../assets/Neon_Logo_01.mp4';

export const ProtectedRoute: React.FC = () => {
  const { isConnected, authLoading } = useAlphaContext();

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <div className="flex flex-col items-center space-y-6">
          {/* Video Loading Animation */}
          <div className="relative">
            <video
              autoPlay
              muted
              loop
              className="opacity-90 drop-shadow-2xl"
              style={{
                width: '512px',
                height: '512px',
                filter: 'drop-shadow(0 0 20px rgba(147, 51, 234, 0.5)) drop-shadow(0 0 40px rgba(147, 51, 234, 0.3))',
                animation: 'pulse 2s ease-in-out infinite'
              }}
            >
              <source src={neonLogoVideo} type="video/mp4" />
              {/* Fallback for browsers that don't support video */}
              <div className="flex items-center justify-center" style={{ width: '512px', height: '512px' }}>
                <svg className="animate-spin h-12 w-12 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </video>
          </div>

          {/* Loading Text */}
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-white animate-pulse">
              Initializing session...
            </p>
            <p className="text-sm text-gray-400">
              Experience the full Alpha Points journey
            </p>
          </div>
        </div>

        <style jsx>{`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}; 