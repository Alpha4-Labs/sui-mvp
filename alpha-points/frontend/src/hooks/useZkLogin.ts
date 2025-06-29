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

// DEPRECATED: This hook is deprecated and will be removed in a future version
// Please use regular wallet connections instead of zkLogin
import { CURRENT_NETWORK } from '../config/network';
// Remove SuiClient instantiation to prevent CORS issues
// const suiClient = new SuiClient({ url: CURRENT_NETWORK.rpcUrl });

export const useZkLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ZkLoginState>(initialState);

   // Optional: Check localStorage on initial load to restore session
   useEffect(() => {
     const existingJwt = localStorage.getItem('zkLogin_jwt');
     const existingProvider = localStorage.getItem('zkLogin_provider') as Provider | null;
     const existingAddress = localStorage.getItem('zkLogin_address'); // Assuming you store address
     // const existingUserSalt = localStorage.getItem('zkLogin_userSalt'); // Also check for salt for full session restore logic

     if (existingJwt && existingProvider && existingAddress /*&& existingUserSalt*/) {
        // Basic check: could add JWT expiry check here
        // console.log("Restoring existing zkLogin session");
        setState({
            isAuthenticated: true,
            address: existingAddress,
            provider: existingProvider,
        });
     }
   }, []);

  const login = useCallback(async (provider: Provider = 'google') => {
    // console.log("--- Running UPDATED useZkLogin login function (using Enoki nonce) ---"); // Updated entry log
    setLoading(true);
    setError(null);
    // console.log(`Initiating zkLogin with ${provider} via Enoki nonce...`);

    try {
      // Generate ephemeral keypair first
      const ephemeralKeypair = new Ed25519Keypair();
      const ephemeralPublicKeyBase64 = ephemeralKeypair.getPublicKey().toSuiPublicKey();
      // console.log("[useZkLogin] Generated Ephemeral Public Key (Base64):", ephemeralPublicKeyBase64);

      // --- Call Enoki Nonce Endpoint --- 
      // console.log("[useZkLogin] Calling Enoki /v1/zklogin/nonce endpoint...");
      const VITE_ENOKI_KEY = import.meta.env.VITE_ENOKI_KEY;
      if (!VITE_ENOKI_KEY) {
          throw new Error("Configuration error: VITE_ENOKI_KEY is missing.");
      }

      const nonceResponseRaw = await fetch('https://api.enoki.mystenlabs.com/v1/zklogin/nonce', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VITE_ENOKI_KEY}`,
        },
        body: JSON.stringify({
          network: 'testnet', // Or your target network
          ephemeralPublicKey: ephemeralPublicKeyBase64,
          // additionalEpochs: 2 // Optional: defaults to 2
        })
      });

      if (!nonceResponseRaw.ok) {
        const errorBody = await nonceResponseRaw.text();
        console.error("Enoki Nonce Request Payload:", { network: 'testnet', ephemeralPublicKey: ephemeralPublicKeyBase64 });
        throw new Error(`Enoki Nonce service error: ${nonceResponseRaw.status} ${nonceResponseRaw.statusText} - ${errorBody}`);
      }

      const nonceResponse = await nonceResponseRaw.json();
      if (!nonceResponse.data || !nonceResponse.data.nonce || !nonceResponse.data.randomness || !nonceResponse.data.maxEpoch) {
        console.error("Invalid Enoki Nonce response structure:", nonceResponse);
        throw new Error("Invalid response structure from Enoki Nonce service.");
      }

      const { nonce, randomness, maxEpoch } = nonceResponse.data; // Destructure directly
      // console.log("[useZkLogin] Received from Enoki Nonce service:", { nonce, randomness, maxEpoch });
      // --- End Enoki Nonce Endpoint Call --- 

      // --- Store necessary data --- 
      // Nonce itself is sent to Google, not stored long-term here usually, but good for debug
      localStorage.setItem('zkLogin_nonce_from_enoki', nonce);
      
      // Store key seed (INSECURE - for demo only) 
      const ephemeralSecretKeySeedString = JSON.stringify(Array.from(ephemeralKeypair.getSecretKey()));
      localStorage.setItem('zkLogin_ephemeralSecretKeySeed', ephemeralSecretKeySeedString);
      // console.log("Stored ephemeral key seed (INSECURE METHOD)");

      // Store Enoki-provided randomness and maxEpoch
      localStorage.setItem('zkLogin_maxEpoch', maxEpoch.toString());
      localStorage.setItem('zkLogin_randomness', randomness); // Enoki returns randomness as string
      
      localStorage.setItem('zkLogin_provider', provider);
      
      // Store public key bytes (still needed by StakeCard to reconstruct pubkey base64 for Enoki ZKP call)
      localStorage.setItem('zkLogin_ephemeralPublicKeyBytes', JSON.stringify(Array.from(ephemeralKeypair.getPublicKey().toRawBytes())));
      // --- End Storing Data --- 

      const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
      // console.log("Using Client ID:", clientId ? clientId.substring(0, 10) + '...' : 'Not Found!');
      if (!clientId) {
          throw new Error("Config Error: VITE_GOOGLE_WEB_CLIENT_ID not set.");
      }

      const redirectUri = `${window.location.origin}/callback`;
      // console.log("Using Redirect URI:", redirectUri);

      const oauthParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'id_token',
        scope: 'openid email profile',
        // Use the nonce received from the Enoki Nonce endpoint
        nonce: nonce, 
      });

      let authUrl;
      switch (provider) {
        case 'google':
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams.toString()}`;
          break;
        default: throw new Error(`Unsupported provider: ${provider}`);
      }
      // console.log("Redirecting to Auth URL...");
      window.location.href = authUrl;

    } catch (err: any) {
      console.error('zkLogin login process error:', err);
      setError(`Failed to initiate login: ${err.message || 'Unknown error'}`);
      setLoading(false);
    }
  }, []); 


  // --- Add handleCallback Function ---
  const handleCallback = useCallback(async (jwt: string) => {
     // console.log("Handling zkLogin callback...");
     setLoading(true);
     setError(null);

     try {
        // --- Get Address and Salt from Enoki --- 
        // console.log("[handleCallback] Calling Enoki GET /v1/zklogin endpoint...");
        const VITE_ENOKI_KEY = import.meta.env.VITE_ENOKI_KEY;
        if (!VITE_ENOKI_KEY) {
            throw new Error("Configuration error: VITE_ENOKI_KEY is missing.");
        }

        const enokiAddressResponseRaw = await fetch('https://api.enoki.mystenlabs.com/v1/zklogin', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${VITE_ENOKI_KEY}`,
                'zklogin-jwt': jwt, 
            }
        });

        if (!enokiAddressResponseRaw.ok) {
            const errorBody = await enokiAddressResponseRaw.text();
            console.error("Enoki GET /zklogin JWT used (first 20 chars):", jwt ? jwt.substring(0,20) : "N/A");
            throw new Error(`Enoki GET /zklogin service error: ${enokiAddressResponseRaw.status} ${enokiAddressResponseRaw.statusText} - ${errorBody}`);
        }
        
        const enokiAddressResponse = await enokiAddressResponseRaw.json();
        if (!enokiAddressResponse.data || !enokiAddressResponse.data.address || !enokiAddressResponse.data.salt) {
           console.error("Invalid Enoki GET /zklogin response structure:", enokiAddressResponse);
           throw new Error("Invalid response structure from Enoki GET /zklogin service.");
        }
        
        const { address, salt: userSaltFromEnoki } = enokiAddressResponse.data;
        // console.log("[handleCallback] Received from Enoki GET /zklogin:", { address, userSaltFromEnoki });
        // --- End Get Address/Salt from Enoki ---
        
        // Retrieve provider from storage
         const provider = localStorage.getItem('zkLogin_provider') as Provider | null;
         if (!provider) {
             // Attempted callback without initiating login?
             throw new Error("Provider not found in localStorage during callback.");
         }

        // Store JWT and Enoki-derived address
        localStorage.setItem('zkLogin_jwt', jwt);
        localStorage.setItem('zkLogin_address', address); // Store Enoki-verified address
        localStorage.setItem('zkLogin_userSalt_from_enoki', userSaltFromEnoki); // Store Enoki salt for debug/potential use

        // Update React state using Enoki-verified address
        setState({
            isAuthenticated: true,
            address: address,
            provider: provider,
        });

        // Nonce is implicitly handled by Google OAuth flow preventing replay of same auth code/id_token.
        // No need to explicitly store/remove nonce after successful callback *here*,
        // but ensure it's not accidentally reused if login flow restarts.

        setLoading(false);
        // console.log("zkLogin authentication successful. Callback handler component should now navigate.");

     } catch (err: any) {
         console.error("Error handling zkLogin callback:", err);
         setError(`Failed to complete authentication: ${err.message || 'Unknown callback error'}`);
         setState(initialState); // Reset state on error
         // Clear potentially partial localStorage data on callback error
         localStorage.removeItem('zkLogin_ephemeralSecretKeySeed');
         localStorage.removeItem('zkLogin_maxEpoch');
         localStorage.removeItem('zkLogin_randomness');
         localStorage.removeItem('zkLogin_provider');
         localStorage.removeItem('zkLogin_ephemeralPublicKeyBytes');
         localStorage.removeItem('zkLogin_nonce_from_enoki');
         // Also remove userSalt if a new one was generated and an error occurred after that
         localStorage.removeItem('zkLogin_userSalt'); // Remove old client-side salt key if present
         localStorage.removeItem('zkLogin_userSalt_from_enoki'); // Remove enoki salt on error too

         setLoading(false);
     }
  }, []);


  // --- Add logout Function ---
  const logout = useCallback(() => {
      // console.log("Logging out from zkLogin...");
      setState(initialState); // Reset React state

      // Clear all related zkLogin items from localStorage
      localStorage.removeItem('zkLogin_ephemeralSecretKeySeed');
      localStorage.removeItem('zkLogin_maxEpoch');
      localStorage.removeItem('zkLogin_randomness');
      localStorage.removeItem('zkLogin_provider');
      localStorage.removeItem('zkLogin_jwt');
      localStorage.removeItem('zkLogin_address');
      localStorage.removeItem('zkLogin_ephemeralPublicKeyBytes');
      localStorage.removeItem('zkLogin_nonce_from_enoki');
      localStorage.removeItem('zkLogin_userSalt'); // Clear old client-side salt key
      localStorage.removeItem('zkLogin_userSalt_from_enoki'); // Also clear enoki salt on logout

       // Optionally redirect to home page after logout
       // window.location.href = '/';
       // console.log("zkLogin local storage cleared.");
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