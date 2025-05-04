// === useZkLogin.ts (Restored Functionality) ===
import { useCallback, useState, useEffect } from 'react'; // Added useEffect potentially
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  generateNonce,
  generateRandomness,
  jwtToAddress
} from '@mysten/sui/zklogin';
// Potentially needed for keypair reconstruction if seed is stored
// import { fromExportedKeypair } from '@mysten/sui/cryptography';

type Provider = 'google' | 'facebook' | 'twitch';

// Define the state structure
interface ZkLoginState {
  isAuthenticated: boolean;
  address: string | null;
  provider: Provider | null;
  // Potentially add user info from JWT if needed
  // userInfo?: Record<string, any>;
}

// Define initial state
const initialState: ZkLoginState = {
  isAuthenticated: false,
  address: null,
  provider: null,
};

// Ensure your SuiClient setup is correct (testnet/mainnet)
const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

export const useZkLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ZkLoginState>(initialState);

   // Optional: Check localStorage on initial load to restore session
   useEffect(() => {
     const existingJwt = localStorage.getItem('zkLogin_jwt');
     const existingProvider = localStorage.getItem('zkLogin_provider') as Provider | null;
     const existingAddress = localStorage.getItem('zkLogin_address'); // Assuming you store address

     if (existingJwt && existingProvider && existingAddress) {
        // Basic check: could add JWT expiry check here
        console.log("Restoring existing zkLogin session");
        setState({
            isAuthenticated: true,
            address: existingAddress,
            provider: existingProvider,
        });
     }
   }, []);

  const login = useCallback(async (provider: Provider = 'google') => {
    setLoading(true);
    setError(null);
    console.log(`Initiating zkLogin with ${provider}...`);

    // Reset state if retrying after error?
    // setState(initialState);
    // Clear relevant localStorage? Depends on desired flow.

    try {
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 2; // Example: active for 2 epochs
      const ephemeralKeypair = new Ed25519Keypair();
      const randomness = generateRandomness();
      const nonce = generateNonce(
        ephemeralKeypair.getPublicKey(),
        maxEpoch,
        randomness
      );
      console.log("Generated Nonce:", nonce);

      // --- CRITICAL SECURITY WARNING ---
      // Storing the secret key seed directly in localStorage is INSECURE for production.
      // Use secure storage (e.g., browser extension APIs, platform secure storage)
      // or manage keys via a dedicated wallet adapter/service.
      const ephemeralSecretKeySeedString = JSON.stringify(Array.from(ephemeralKeypair.getSecretKey()));
      localStorage.setItem('zkLogin_ephemeralSecretKeySeed', ephemeralSecretKeySeedString);
      console.log("Stored ephemeral key seed (INSECURE METHOD)");
      // --- End Warning ---

      // Store other necessary info
      localStorage.setItem('zkLogin_maxEpoch', maxEpoch.toString());
      localStorage.setItem('zkLogin_randomness', randomness);
      localStorage.setItem('zkLogin_provider', provider);
      // Store public key bytes as string array for potential reconstruction
      localStorage.setItem('zkLogin_ephemeralPublicKeyBytes', JSON.stringify(Array.from(ephemeralKeypair.getPublicKey().toRawBytes())));


      const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
      console.log("Using Client ID:", clientId ? clientId.substring(0, 10) + '...' : 'Not Found!');

      if (!clientId) {
          const errorMsg = "Config Error: VITE_GOOGLE_WEB_CLIENT_ID not set.";
          console.error(errorMsg); setError(errorMsg); setLoading(false); return;
      }

      const redirectUri = `${window.location.origin}/callback`;
      console.log("Using Redirect URI:", redirectUri);
      // Ensure origin and redirect URI are configured in Google Cloud Console

      const oauthParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce: nonce,
      });

      let authUrl;
      switch (provider) {
        case 'google':
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams.toString()}`;
          break;
        default: throw new Error(`Unsupported provider: ${provider}`);
      }
      console.log("Redirecting to Auth URL...");

      // Redirect user
      window.location.href = authUrl;

    } catch (err: any) {
      console.error('zkLogin login process error:', err);
      setError(`Failed to initiate login: ${err.message || 'Unknown error'}`);
      setLoading(false);
    }
    // No setLoading(false) here because of redirection
  }, [/* suiClient */]); // Removed suiClient dependency as getLatestSuiSystemState is outside useCallback now


  // --- Add handleCallback Function ---
  const handleCallback = useCallback(async (jwt: string) => {
     console.log("Handling zkLogin callback...");
     setLoading(true);
     setError(null);

     try {
        // --- CRITICAL: User Salt ---
        // Replace BigInt(0) with a unique, secure salt for each user.
        const userSalt = BigInt(0); // <<< REPLACE THIS IN PRODUCTION
        console.warn("Using insecure userSalt (BigInt(0)) for zkLogin address derivation.");
        // --- End Salt Warning ---

        // Derive the Sui address
        const address = jwtToAddress(jwt, userSalt);
        console.log("Derived zkLogin address:", address);

        // Retrieve provider from storage
         const provider = localStorage.getItem('zkLogin_provider') as Provider | null;
         if (!provider) {
             // Attempted callback without initiating login?
             throw new Error("Provider not found in localStorage during callback.");
         }

        // Store JWT and derived address
        localStorage.setItem('zkLogin_jwt', jwt);
        localStorage.setItem('zkLogin_address', address); // Store address for session restore

        // Update React state
        setState({
            isAuthenticated: true,
            address: address,
            provider: provider,
        });

        // Nonce is implicitly handled by Google OAuth flow preventing replay of same auth code/id_token.
        // No need to explicitly store/remove nonce after successful callback *here*,
        // but ensure it's not accidentally reused if login flow restarts.

        setLoading(false);
        console.log("zkLogin authentication successful.");

        // Redirect to the dashboard
        // Consider using useNavigate() from react-router-dom if available in context
        window.location.href = '/dashboard';

     } catch (err: any) {
         console.error("Error handling zkLogin callback:", err);
         setError(`Failed to complete authentication: ${err.message || 'Unknown callback error'}`);
         setState(initialState); // Reset state on error
         // Clear potentially partial localStorage data on callback error
         localStorage.removeItem('zkLogin_jwt');
         localStorage.removeItem('zkLogin_address');
         // Keep provider/maxEpoch/randomness/key? Or clear all? Depends on desired retry behavior.
         // Let's clear all for simplicity on error during callback:
         localStorage.removeItem('zkLogin_ephemeralSecretKeySeed');
         localStorage.removeItem('zkLogin_maxEpoch');
         localStorage.removeItem('zkLogin_randomness');
         localStorage.removeItem('zkLogin_provider');
         localStorage.removeItem('zkLogin_ephemeralPublicKeyBytes');
         localStorage.removeItem('zkLogin_nonce');

         setLoading(false);
     }
  }, [/* dependencies */]); // No dependencies needed if only using localStorage and setting state


  // --- Add logout Function ---
  const logout = useCallback(() => {
      console.log("Logging out from zkLogin...");
      setState(initialState); // Reset React state

      // Clear all related zkLogin items from localStorage
      localStorage.removeItem('zkLogin_ephemeralSecretKeySeed');
      localStorage.removeItem('zkLogin_maxEpoch');
      localStorage.removeItem('zkLogin_randomness');
      localStorage.removeItem('zkLogin_provider');
      localStorage.removeItem('zkLogin_jwt');
      localStorage.removeItem('zkLogin_address');
      localStorage.removeItem('zkLogin_ephemeralPublicKeyBytes');
      localStorage.removeItem('zkLogin_nonce');

       // Optionally redirect to home page after logout
       // window.location.href = '/';
       console.log("zkLogin local storage cleared.");
  }, []);


  // --- Update Return Statement ---
  return {
    // Functions
    login,
    handleCallback, // Include handleCallback
    logout,         // Include logout

    // State
    loading,
    error,
    isAuthenticated: state.isAuthenticated, // Include authentication state
    address: state.address,               // Include derived address
    provider: state.provider              // Include provider
  };
};