// === useZkLogin.ts (Fixed Version) ===
import { useCallback, useState } from 'react';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { 
  generateNonce, 
  generateRandomness, 
  jwtToAddress 
} from '@mysten/sui/zklogin';

// Define the OAuth provider options
type Provider = 'google' | 'facebook' | 'twitch';

interface ZkLoginState {
  isAuthenticated: boolean;
  address: string | null;
  provider: Provider | null;
}

export const useZkLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ZkLoginState>({
    isAuthenticated: false,
    address: null,
    provider: null
  });
  
  // Create SuiClient for getting current epoch
  const suiClient = new SuiClient({
    url: 'https://fullnode.testnet.sui.io'
  });

  // Login process
  const login = useCallback(async (provider: Provider = 'google') => {
    setLoading(true);
    setError(null);
    
    try {
      // Get the current epoch for maxEpoch calculation
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 2; // Active for 2 epochs from now
      
      // Generate keypair and randomness for nonce
      const ephemeralKeypair = new Ed25519Keypair();
      const randomness = generateRandomness();
      
      // Generate nonce with all required parameters
      const nonce = generateNonce(
        ephemeralKeypair.getPublicKey(), 
        maxEpoch, 
        randomness
      );
      
      // Store necessary data in localStorage
      localStorage.setItem('zkLogin_nonce', nonce);
      localStorage.setItem('zkLogin_maxEpoch', maxEpoch.toString());
      localStorage.setItem('zkLogin_randomness', randomness);
      
      // Store the public key
      const pubKeyBytes = ephemeralKeypair.getPublicKey().toRawBytes();
      localStorage.setItem('zkLogin_ephemeralPublicKey', 
        Array.from(pubKeyBytes).toString());
      
      // Store the keypair - in a real app, use a more secure method
      // We need to store the keypair to sign transactions later
      // This is stored as a seed phrase or by another secure means in production
      localStorage.setItem('zkLogin_ephemeralKeypairSeed', 
        Array.from(ephemeralKeypair.getSecretKey()).toString());
      
      // Define OAuth parameters
      const oauthParams = new URLSearchParams({
        client_id: import.meta.env.VITE_OAUTH_CLIENT_ID || 'YOUR_CLIENT_ID',
        redirect_uri: `${window.location.origin}/callback`,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce: nonce,
        state: nonce, // For CSRF protection
      });
      
      // Build the auth URL based on provider
      let authUrl;
      switch (provider) {
        case 'google':
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams.toString()}`;
          break;
        case 'facebook':
          authUrl = `https://www.facebook.com/v16.0/dialog/oauth?${oauthParams.toString()}`;
          break;
        case 'twitch':
          authUrl = `https://id.twitch.tv/oauth2/authorize?${oauthParams.toString()}`;
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
      
      // Store the provider for later use
      localStorage.setItem('zkLogin_provider', provider);
      
      // Redirect user to the OAuth provider
      window.location.href = authUrl;

    } catch (err) {
      console.error('zkLogin error:', err);
      setError('Failed to login with zkLogin. Please try again.');
      setLoading(false);
    }
  }, []);

  // Handle callback from OAuth provider
  const handleCallback = useCallback(async (jwt: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // For demonstration, we'll derive an address from the JWT
      const userSalt = BigInt(0); // In production this should be a proper salt
      
      // Use the jwtToAddress function to get a compatible address
      const address = jwtToAddress(jwt, userSalt);
      
      // Store the JWT
      localStorage.setItem('zkLogin_jwt', jwt);
      
      // Store the address
      setState({
        isAuthenticated: true,
        address,
        provider: localStorage.getItem('zkLogin_provider') as Provider
      });
      
      // Clear temporary data that's no longer needed
      localStorage.removeItem('zkLogin_nonce');
      
      setLoading(false);
      
      // Return to the main page or dashboard
      window.location.href = '/dashboard';
      
    } catch (err) {
      console.error('zkLogin callback error:', err);
      setError('Failed to complete authentication. Please try again.');
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setState({
      isAuthenticated: false,
      address: null,
      provider: null
    });
    
    // Clear stored data
    localStorage.removeItem('zkLogin_jwt');
    localStorage.removeItem('zkLogin_provider');
    localStorage.removeItem('zkLogin_ephemeralPublicKey');
    localStorage.removeItem('zkLogin_ephemeralKeypairSeed');
    localStorage.removeItem('zkLogin_maxEpoch');
    localStorage.removeItem('zkLogin_randomness');
  }, []);

  return {
    login,
    handleCallback,
    logout,
    loading,
    error,
    isAuthenticated: state.isAuthenticated,
    address: state.address,
    provider: state.provider
  };
};