// === ZkLoginCallback.tsx (New Component) ===
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZkLogin } from '../hooks/useZkLogin';
import { jwtDecode } from 'jwt-decode';

export const ZkLoginCallback: React.FC = () => {
  const { handleCallback, loading, error } = useZkLogin();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Extract the JWT token from the URL hash fragment
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');
    
    if (idToken) {
      // Process the JWT token
      handleCallback(idToken);
      
      // Optional: You can decode and display some info from the JWT
      try {
        const decoded = jwtDecode(idToken) as any;
        console.log('JWT decoded:', decoded);
      } catch (err) {
        console.error('Failed to decode JWT:', err);
      }
    } else {
      // No token found, redirect to login page
      navigate('/');
    }
  }, [handleCallback, navigate]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-card text-white">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block w-8 h-8 border-t-2 border-primary animate-spin rounded-full"></div>
          </div>
          <p>Completing authentication...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-card text-white">
        <div className="text-center">
          <div className="text-red-500 mb-4">Authentication failed</div>
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }
  
  return <div></div>;
};