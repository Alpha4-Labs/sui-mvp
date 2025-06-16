import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import {
  buildRequestAddStakeTransaction, 
  buildRegisterStakeTransaction 
} from '../utils/transaction';
import {
  getTransactionErrorMessage,
  getTransactionResponseError,
  getCreatedObjects
} from '../utils/transaction-adapter';
import { formatSui, calculateAlphaPointsPerDayPerSui } from '../utils/format';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair, Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import {
  SuiTransactionBlockResponse, 
  SuiObjectChangeCreated, 
  SuiClient,
} from '@mysten/sui/client';
import { 
    getZkLoginSignature, 
    ZkLoginSignatureInputs as ActualZkLoginSignatureInputs,
    ZkLoginPublicIdentifier,
} from '@mysten/sui/zklogin'; 
import { Buffer } from 'buffer/';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTransactionSuccess } from '../hooks/useTransactionSuccess';

// --- Validator List (Re-added for random selection) ---
const validators = [
  { name: 'Staketab', address: '0x2ade594485fb795616b74156c91097ec517a05ac488364dd3ad1ec5f536db3f4' },
  { name: 'SyncNode', address: '0x764c9ed72c944d314290a257b4a88211c8e529257fc2fd00d3cb0b5b5666d8a7' },
  { name: 'Citadel.one', address: '0x4f9791d5c689306862b4eb9a25914c5433b7dfd5cb4827b461f7dfc813f28a7c' },
  { name: 'Stardust S...', address: '0x51c0c51634393f904cbeed910714943a30a47a6dafaab99c59bdcac2521ba733' },
  { name: 'Staking F...', address: '0xc397477d8b445e6295bc34e593b9a95d5d233cec1a8fe3740d0ab86012a460f6' },
  { name: 'MoveFuns DAO', address: '0x8ffaea5d47a38291e5dd390b6d4c40fd3b1f17864aec217a2f808d8f1ca9b26b' },
  { name: 'Neuler', address: '0x163f66f793f03ac3f309fc97058f5997283ccbdf92e4d4fa3323d290801375d8' },
  { name: 'BwareLabs', address: '0xce2039cd80188004f995cdfe1360b31d4118bd4257febee958b6c6dcd861131d' },
  { name: 'Kriya Validator', address: '0x63ef9ef897aed3be07ed1c54d78ec349c31155224022558971bc555058a89f33' },
  { name: 'Cosmosta...', address: '0xbfaf08e600526abe628f4f5351278de290268c81c8ccd0217d6bd302e9645617' },
];

// Type for staking process state
type StakingStage = 'idle' | 'requestingStake' | 'fetchingProof' | 'registeringStake' | 'failed' | 'success';

// Interface for decoded JWT payload (add more fields as needed)
interface DecodedJwt {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  nonce: string;
  maxEpoch: number; // Not directly in JWT, but needed for logic
  eph_pub_key: string; // Base64 encoded extended ephemeral public key - THIS SHOULD BE IN JWT for prover
  // Claims for ZkLoginSignatureInputs
  aud_claim?: string; 
  index_mod_4_claim?: number;
}

// Define types for ZK Proof components based on ActualZkLoginSignatureInputs structure
interface ZkProofPoints {
    a: string[];
    b: string[][];
    c: string[];
}

interface IssBase64DetailsClaim {
    value: string;
    indexMod4: number;
}

// Define the expected structure of the ZK Prover response from Enoki
interface EnokiZkpData {
  proofPoints: ZkProofPoints;
  issBase64Details: IssBase64DetailsClaim;
  headerBase64: string;
  addressSeed: string; // Enoki provides the addressSeed
}

interface EnokiZkpResponse {
  data: EnokiZkpData;
}

// Helper function for delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const StakeCard: React.FC = () => {
  const {
    refreshData,
    durations,
    selectedDuration,
    setSelectedDuration,
    setTransactionLoading,
    loading: contextLoading,
    address: alphaAddress,
    isConnected: alphaIsConnected,
    provider: alphaProvider,
    suiBalance,
    loading: { suiBalance: isLoadingBalance },
    stakePositions,
  } = useAlphaContext();

  const suiClient = useSuiClient();

  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State for multi-stage staking process
  const [stakingStage, setStakingStage] = useState<StakingStage>('idle');
  const [stakedSuiId, setStakedSuiId] = useState<string | null>(null);
  const [txDigest1, setTxDigest1] = useState<string | null>(null);
  const [txDigest2, setTxDigest2] = useState<string | null>(null);

  // State to track if the default duration has been set
  const [isDefaultDurationSet, setIsDefaultDurationSet] = useState(false);

    // Use transaction success hook for automatic refresh
  const { registerRefreshCallback, signAndExecute } = useTransactionSuccess();

  // Register refresh callback for this component
  useEffect(() => {
    const cleanup = registerRefreshCallback(async () => {
      // Refresh all data after successful staking transactions
      await refreshData();
    });

    return cleanup; // Cleanup on unmount
  }, [registerRefreshCallback, refreshData]);

  // Correctly find the index of the current selectedDuration - add null check
  const selectedDurationIndex = selectedDuration ? durations.findIndex(d => d.days === selectedDuration.days) : -1;

  // --- Validation Functions ---
  const checkSufficientBalance = () => {
    if (!amount || !suiBalance) return true; // Don't block if no amount entered or balance loading
    
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) return true; // Don't block for invalid amounts, let other validation handle it
    
    const amountInMist = BigInt(Math.floor(amountFloat * 1_000_000_000));
    const availableInMist = BigInt(suiBalance);
    const gasBuffer = BigInt(10_000_000); // 0.01 SUI buffer
    const minStakeSuiSystem = BigInt(1_000_000_000); // 1 SUI minimum
    
    return amountInMist >= minStakeSuiSystem && amountInMist + gasBuffer <= availableInMist;
  };

  // Get validation state and message for the current amount
  const getAmountValidation = () => {
    if (!amount || amount.trim() === '') {
      return { isValid: true, message: '', type: 'neutral' };
    }

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      return { isValid: false, message: 'Please enter a valid positive amount', type: 'error' };
    }

    if (!suiBalance) {
      return { isValid: true, message: 'Loading balance...', type: 'loading' };
    }

    const amountInMist = BigInt(Math.floor(amountFloat * 1_000_000_000));
    const availableInMist = BigInt(suiBalance);
    const gasBuffer = BigInt(10_000_000); // 0.01 SUI buffer
    const minStakeSuiSystem = BigInt(1_000_000_000); // 1 SUI minimum

    // Check minimum requirement
    if (amountInMist < minStakeSuiSystem) {
      return { 
        isValid: false, 
        message: 'Minimum stake amount is 1.00 SUI', 
        type: 'error' 
      };
    }

    // Check if enough balance for amount + buffer
    if (amountInMist + gasBuffer > availableInMist) {
      const availableForStaking = (Number(availableInMist - gasBuffer) / 1_000_000_000);
      const availableDisplay = availableForStaking > 0 ? availableForStaking.toFixed(3) : '0';
      return { 
        isValid: false, 
        message: `Insufficient balance. Available: ${availableDisplay} SUI (after 0.01 gas buffer)`, 
        type: 'error' 
      };
    }

    // Valid amount
    return { 
      isValid: true, 
      message: `✓ Valid amount (${(Number(gasBuffer) / 1_000_000_000).toFixed(2)} SUI reserved for gas)`, 
      type: 'success' 
    };
  };

  const validation = getAmountValidation();

  const handleDurationSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sliderIndex = parseInt(event.target.value, 10);
    if (durations[sliderIndex]) {
      setSelectedDuration(durations[sliderIndex]);
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (alphaIsConnected) {
      setError(null);
    }
  }, [alphaIsConnected]);

  useEffect(() => {
    // Update global loading state based on staking stage
    setTransactionLoading(stakingStage === 'requestingStake' || stakingStage === 'registeringStake' || stakingStage === 'fetchingProof');
  }, [stakingStage, setTransactionLoading]);

  // Effect to set the default duration to 30 days
  useEffect(() => {
    if (!isDefaultDurationSet && durations && durations.length > 0 && setSelectedDuration) {
      const thirtyDayOption = durations.find(d => d.days === 30);
      if (thirtyDayOption) {
        setSelectedDuration(thirtyDayOption);
        setIsDefaultDurationSet(true);
      }
    }
  }, [isDefaultDurationSet, durations, setSelectedDuration, selectedDuration]); // Added selectedDuration to ensure it runs if context provides a different initial value

  // --- Helper Functions ---

  /**
   * Parses the transaction response to find the newly created StakedSui object ID.
   */
  const findStakedSuiObjectId = (response: SuiTransactionBlockResponse): string | null => {
    const created = getCreatedObjects(response);
    if (!created) return null;

    // Find the object with type ending in `::staking_pool::StakedSui`
    const stakedSuiObject = created.find((obj: SuiObjectChangeCreated) => 
      obj.objectType.endsWith('::staking_pool::StakedSui')
    );
    
    return stakedSuiObject ? stakedSuiObject.objectId : null;
  };

  // Handler to navigate to staked positions
  const handleViewStakedPositions = () => {
    // Scroll to the staked positions section or navigate to it
    const stakedPositionsElement = document.querySelector('[data-section="staked-positions"]');
    if (stakedPositionsElement) {
      stakedPositionsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // If no element found, just scroll down a bit to find the staked positions
      window.scrollBy({ top: 400, behavior: 'smooth' });
    }
  };

  // --- Primary Stake Function ---

  const handleStake = async () => {
    setError(null);
    setSuccess(null);
    setStakedSuiId(null);
    setTxDigest1(null);
    setTxDigest2(null);
    setStakingStage('idle');

    if (!alphaIsConnected || !alphaAddress) return setError("Please connect your wallet or sign in.");
    if (stakingStage !== 'idle' && stakingStage !== 'failed' && stakingStage !== 'success') return;
    if (!selectedDuration) return setError("Please select a staking duration.");

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) return setError("Please enter a valid positive amount");

    const amountInMist = BigInt(Math.floor(amountFloat * 1_000_000_000));
    const availableInMist = BigInt(suiBalance);
    const gasBuffer = BigInt(10_000_000); 
    const minStakeSuiSystem = BigInt(1_000_000_000); // 1 SUI for sui_system::request_add_stake
    
    if (amountInMist < minStakeSuiSystem) {
      toast.error('Minimum stake amount is 1 SUI + 0.01 buffer for gas fees.', {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "dark",
      });
      return;
    }
    
    if (amountInMist + gasBuffer > availableInMist) {
      toast.error('Insufficient balance: You need at least 1 SUI + 0.01 buffer for gas fees.', {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "dark",
      });
      return;
    }

    // Randomly select a validator from the list
    const randomIndex = Math.floor(Math.random() * validators.length);
    const selectedValidator = validators[randomIndex];
    if (!selectedValidator) throw new Error("Failed to select a validator");
    const validatorAddressToUse = selectedValidator.address;
   
    setStakingStage('requestingStake');
    let tx1Digest: string | null = null; 
    let newStakedSuiId: string | null = null;

    try {
      const tx1 = buildRequestAddStakeTransaction(amountInMist, validatorAddressToUse);

      if (alphaProvider === 'google') {
        tx1.setSender(alphaAddress);
        
        const jwt = localStorage.getItem('zkLogin_jwt');
        const secretKeySeedString = localStorage.getItem('zkLogin_ephemeralSecretKeySeed');
        const maxEpochString = localStorage.getItem('zkLogin_maxEpoch');
        const randomnessString = localStorage.getItem('zkLogin_randomness');
        const publicKeyBytesString = localStorage.getItem('zkLogin_ephemeralPublicKeyBytes');

        if (!jwt || !secretKeySeedString || !maxEpochString || !randomnessString || !publicKeyBytesString) {
          throw new Error("Missing required zkLogin data from localStorage for Tx1 (Direct ZKP)");
        }

        const secretKeySeed = Uint8Array.from(JSON.parse(secretKeySeedString));
        const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKeySeed.slice(0, 32));
        const maxEpoch = parseInt(maxEpochString, 10);
        const randomness = randomnessString;
        const publicKeyBytes = Uint8Array.from(JSON.parse(publicKeyBytesString));
        const ephemeralPublicKey = new Ed25519PublicKey(publicKeyBytes);
        const extendedEphemeralPublicKeyString = ephemeralPublicKey.toSuiPublicKey();

        setStakingStage('fetchingProof');

        try {
            const fullTxBytes = await tx1.build({ client: suiClient as unknown as SuiClient });

            const { signature: userSignature } = await ephemeralKeypair.signTransaction(fullTxBytes); 

            const enokiZkpRequest = {
                network: 'testnet',
                ephemeralPublicKey: extendedEphemeralPublicKeyString,
                maxEpoch: maxEpoch,
                randomness: randomness,
            };

            const enokiZkpResponseRaw = await fetch('https://api.enoki.mystenlabs.com/v1/zklogin/zkp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env['VITE_ENOKI_KEY']}`,
                    'zklogin-jwt': jwt, 
                },
                body: JSON.stringify(enokiZkpRequest)
            });

            if (!enokiZkpResponseRaw.ok) {
                const errorBody = await enokiZkpResponseRaw.text();
                throw new Error(`Enoki ZKP service error (Tx1): ${enokiZkpResponseRaw.status} ${enokiZkpResponseRaw.statusText} - ${errorBody}`);
            }
            const enokiResponse: EnokiZkpResponse = await enokiZkpResponseRaw.json();
            if (!enokiResponse.data?.proofPoints) throw new Error("Invalid ZKP response from Enoki (Tx1).");

            const zkLoginInputs: ActualZkLoginSignatureInputs = {
                 proofPoints: enokiResponse.data.proofPoints,
                 issBase64Details: enokiResponse.data.issBase64Details,
                 headerBase64: enokiResponse.data.headerBase64,
                 addressSeed: localStorage.getItem('zkLogin_userSalt_from_enoki') || '',
            };

            const actualZkLoginSignature = getZkLoginSignature({ inputs: zkLoginInputs, maxEpoch, userSignature });

            setStakingStage('requestingStake'); 
            const result1 = await suiClient.executeTransactionBlock({ 
              transactionBlock: fullTxBytes,
              signature: actualZkLoginSignature,
              options: { showEffects: true, showObjectChanges: true }
            }); 
            tx1Digest = result1.digest;
            setTxDigest1(tx1Digest);
            newStakedSuiId = findStakedSuiObjectId(result1);

        } catch (directZkpError: any) {
            console.error("Error during Direct ZKP Flow (Tx1):", directZkpError);
            setError(`Failed during ZKP flow (Tx1): ${directZkpError.message || 'Unknown ZKP/execution error'}`);
            setStakingStage('failed');
            return;
        }

      } else if (alphaProvider === 'dapp-kit') {
        const signResult1 = await signAndExecute({ transaction: tx1.serialize() }); 

        tx1Digest = signResult1.digest;
        setTxDigest1(tx1Digest);

        const delayMs = 3000;
        await sleep(delayMs); 
        
        const result1 = await suiClient.getTransactionBlock({ 
          digest: tx1Digest, 
          options: { showEffects: true, showObjectChanges: true }
        });

        const responseError1 = getTransactionResponseError(result1);
        if (responseError1) throw new Error(`Tx1 Error: ${responseError1}`);
        newStakedSuiId = findStakedSuiObjectId(result1);

      } else {
        throw new Error ("Cannot determine execution path for Tx1");
      }

      if (!newStakedSuiId) {
        console.error("Could not find StakedSui object ID in Tx1 results.");
        toast.error("Stake request was cancelled or failed. Please ensure the first transaction is approved and try again.", {
          position: "top-center",
          autoClose: 7000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "dark",
        });
        setStakingStage('failed');
        setTransactionLoading(false);
        return;
      }
      setStakedSuiId(newStakedSuiId);

    } catch (error: any) {
      console.error('Error during Tx1 preparation/execution:', error);
      setError(getTransactionErrorMessage(error));
      setStakingStage('failed');
    }

    if (!newStakedSuiId) {
        toast.error("Failed to obtain necessary stake information after the first step. Please try again.", {
            position: "top-center",
            autoClose: 7000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "dark",
        });
        setStakingStage('failed');
        setTransactionLoading(false);
      return;
    }

    setStakingStage('registeringStake');
    let tx2Digest: string | null = null;

    try {
      if (!selectedDuration) {
        throw new Error("Selected duration is required for registration");
      }
      const tx2 = buildRegisterStakeTransaction(newStakedSuiId, selectedDuration.days);

      if (alphaProvider === 'google') {
        tx2.setSender(alphaAddress);
        
        const jwt = localStorage.getItem('zkLogin_jwt');
        const secretKeySeedString = localStorage.getItem('zkLogin_ephemeralSecretKeySeed');
        const maxEpochStringTx2 = localStorage.getItem('zkLogin_maxEpoch');
        const randomnessStringTx2 = localStorage.getItem('zkLogin_randomness');
        const publicKeyBytesStringTx2 = localStorage.getItem('zkLogin_ephemeralPublicKeyBytes');

        if (!jwt || !secretKeySeedString || !maxEpochStringTx2 || !randomnessStringTx2 || !publicKeyBytesStringTx2) {
             console.error("Tx2 - Missing zkLogin items from localStorage.", { jwtPresent: !!jwt, secretKeySeedStringPresent: !!secretKeySeedString, maxEpochStringPresent: !!maxEpochStringTx2, randomnessStringPresent: !!randomnessStringTx2, publicKeyBytesStringPresent: !!publicKeyBytesStringTx2 });
             throw new Error("Missing zkLogin data for Tx2");
        }

        const secretKeySeed = Uint8Array.from(JSON.parse(secretKeySeedString));
        const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKeySeed.slice(0, 32));
        const maxEpochTx2 = parseInt(maxEpochStringTx2, 10);
        const randomnessTx2 = randomnessStringTx2;
        const publicKeyBytesTx2 = Uint8Array.from(JSON.parse(publicKeyBytesStringTx2));
        const ephemeralPublicKeyTx2 = new Ed25519PublicKey(publicKeyBytesTx2);
        const extendedEphemeralPublicKeyStringTx2 = ephemeralPublicKeyTx2.toSuiPublicKey();

        if (isNaN(maxEpochTx2)) {
           console.error("Tx2 - maxEpoch is NaN!");
           throw new Error("Invalid maxEpoch for Tx2");
        }
        
        const fullTxBytes2 = await tx2.build({ client: suiClient as unknown as SuiClient });

        const signedData2 = await ephemeralKeypair.signTransaction(fullTxBytes2);
        const userSignature2 = signedData2.signature;
        
        setStakingStage('fetchingProof');

        const VITE_ENOKI_KEY_TX2 = import.meta.env['VITE_ENOKI_KEY'];
        if (!VITE_ENOKI_KEY_TX2) {
            console.error("VITE_ENOKI_KEY not found for Tx2.");
            setError("Configuration error: Enoki API Key missing for Tx2.");
            setStakingStage('failed');
            return;
        }

        try {
            const enokiZkpRequestTx2 = {
                network: 'testnet',
                ephemeralPublicKey: extendedEphemeralPublicKeyStringTx2,
                maxEpoch: maxEpochTx2,
                randomness: randomnessTx2,
            };

            const enokiZkpResponseRawTx2 = await fetch('https://api.enoki.mystenlabs.com/v1/zklogin/zkp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${VITE_ENOKI_KEY_TX2}`,
                    'zklogin-jwt': jwt,
                },
                body: JSON.stringify(enokiZkpRequestTx2)
            });

            if (!enokiZkpResponseRawTx2.ok) {
                const errorBodyTx2 = await enokiZkpResponseRawTx2.text();
                throw new Error(`Enoki ZKP service error (Tx2): ${enokiZkpResponseRawTx2.status} ${enokiZkpResponseRawTx2.statusText} - ${errorBodyTx2}`);
            }

            const enokiResponseTx2: EnokiZkpResponse = await enokiZkpResponseRawTx2.json();
            
            if (!enokiResponseTx2.data || !enokiResponseTx2.data.proofPoints || !enokiResponseTx2.data.issBase64Details || !enokiResponseTx2.data.headerBase64 || !enokiResponseTx2.data.addressSeed) {
               throw new Error("Invalid response from Enoki ZKP (Tx2).");
            }
            
            const zkLoginSignatureInputsTx2: ActualZkLoginSignatureInputs = {
                proofPoints: enokiResponseTx2.data.proofPoints,
                issBase64Details: enokiResponseTx2.data.issBase64Details,
                headerBase64: enokiResponseTx2.data.headerBase64,
                addressSeed: enokiResponseTx2.data.addressSeed,
            };

            setStakingStage('registeringStake'); 
            const actualZkLoginSignature2 = getZkLoginSignature({ inputs: zkLoginSignatureInputsTx2, maxEpoch: maxEpochTx2, userSignature: userSignature2 });
        
            const result2 = await suiClient.executeTransactionBlock({ 
              transactionBlock: fullTxBytes2,
              signature: actualZkLoginSignature2,
              options: { showEffects: true }
            });
            tx2Digest = result2.digest;
            setTxDigest2(tx2Digest);

        } catch (proofErrorTx2: any) {
            console.error("Error during Enoki ZK proof stage (Tx2):", proofErrorTx2);
            setError(`Failed during ZK proof stage (Tx2): ${proofErrorTx2.message || 'Unknown proof error'}`);
            setStakingStage('failed');
            return;
        }
      } else if (alphaProvider === 'dapp-kit') {
        const signResult2 = await signAndExecute({ transaction: tx2.serialize() }); 
        tx2Digest = signResult2.digest;
        setTxDigest2(tx2Digest);
      } else {
        throw new Error ("Cannot determine execution path for Tx2");
      }
      
      setStakingStage('success');
      setSuccess(`Successfully staked ${formatSui(amountInMist.toString())} SUI!`);
      setAmount('');
      // Show toast with digest links
      toast.success(
        <div>
          <div>Successfully staked {formatSui(amountInMist.toString())} SUI!</div>
          {tx1Digest && (
            <div className="mt-1 text-xs">
              Tx1 Digest: <a href={`https://suiscan.xyz/testnet/tx/${tx1Digest}`} target="_blank" rel="noopener noreferrer" className="underline">{tx1Digest.substring(0, 10)}...</a>
            </div>
          )}
          {tx2Digest && (
            <div className="mt-1 text-xs">
              Tx2 Digest: <a href={`https://suiscan.xyz/testnet/tx/${tx2Digest}`} target="_blank" rel="noopener noreferrer" className="underline">{tx2Digest.substring(0, 10)}...</a>
            </div>
          )}
        </div>,
        { position: 'top-right', autoClose: 7000, hideProgressBar: false, closeOnClick: true, pauseOnHover: true, draggable: true }
      );
      // Component will automatically refresh via transaction success hook

    } catch (error: any) {
      console.error('Error during Tx2:', error);
      setError(getTransactionErrorMessage(error));
      setStakingStage('failed');
    } finally {
      setTransactionLoading(false);
    }
  };

  // --- Button Label Logic ---
  const getButtonLabel = () => {
    switch (stakingStage) {
      case 'requestingStake': return 'Requesting Stake...';
      case 'fetchingProof': return 'Fetching ZK Proof...';
      case 'registeringStake': return 'Registering Stake...';
      case 'idle':
      case 'success':
      case 'failed':
      default:
         return !alphaIsConnected ? 'Connect Wallet or Sign In' : 'Stake SUI';
    }
  };

  // --- JSX Rendering --- 
  return (
    <div className="card-modern p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Manage Stake</h2>
            <p className="text-xs text-gray-400">Stake SUI to earn Alpha Points</p>
          </div>
        </div>

        {/* Total Staked Summary */}
        <div className="text-right">
          <p className="text-xs text-gray-400">Total Staked</p>
          <p className="text-xs font-semibold text-white">
            {(() => {
              // Calculate total staked from stakePositions
              const totalStaked = stakePositions.reduce((sum, position) => {
                const principal = parseFloat(position.principal || '0');
                return sum + (principal / 1_000_000_000); // Convert MIST to SUI
              }, 0);
              return formatSui((totalStaked * 1_000_000_000).toString());
            })()} <span className="text-blue-400">SUI</span>
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm animate-fade-in">
          {success}
        </div>
      )}

      {/* Toast container for react-toastify */}
      <ToastContainer />

      <div className="space-y-4">
        {/* Amount and Duration Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stake Amount Input */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <label htmlFor="stake-amount" className="text-sm font-medium text-gray-300">
                  Amount to Stake
                </label>
                {/* Tooltip Icon */}
                <div className="relative group">
                  <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 backdrop-blur-lg border border-white/20 rounded-lg text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                    Minimum SUI to stake = 1
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (suiBalance && !isLoadingBalance) {
                    const availableInSui = parseFloat(suiBalance) / 1_000_000_000;
                    const gasBufferInSui = 0.01;
                    const maxPossible = Math.max(0, availableInSui - gasBufferInSui);
                    const minStakeSui = 1.0;
                    if (maxPossible >= minStakeSui) {
                      setAmount(maxPossible.toFixed(9).replace(/\.?0+$/, ''));
                    } else {
                      setAmount('');
                      toast.error(`Insufficient balance. You need at least ${minStakeSui + gasBufferInSui} SUI.`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        theme: "dark",
                      });
                    }
                  }
                }}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
                disabled={!alphaIsConnected || isLoadingBalance || contextLoading.transaction}
              >
                Max
              </button>
            </div>
            
            <div className="relative group">
              <input
                id="stake-amount"
                type="text"
                inputMode="decimal"
                pattern="^[0-9]*[.,]?[0-9]*$"
                value={amount}
                onChange={(e) => {
                  const value = e.target.value.replace(',', '.');
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setAmount(value);
                  }
                }}
                placeholder="1"
                className={`w-full bg-black/20 backdrop-blur-lg border rounded-xl px-4 py-3 text-white placeholder:text-gray-400 focus:ring-2 transition-all duration-300 pr-12 ${
                  validation.type === 'error' 
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                    : validation.type === 'success'
                    ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
                    : 'border-white/10 focus:border-purple-500/50 focus:ring-purple-500/20'
                }`}
                aria-label="Amount to Stake in SUI"
                disabled={!alphaIsConnected || contextLoading.transaction}
                title={validation.type === 'error' ? validation.message : ''}
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-medium">
                SUI
              </span>
              
              {/* Validation Tooltip */}
              {validation.type === 'error' && validation.message && (
                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-red-900/90 backdrop-blur-lg border border-red-500/30 rounded-lg text-xs text-red-200 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible focus-within:opacity-100 focus-within:visible transition-all duration-200 z-10 pointer-events-none">
                  {validation.message}
                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-900/90"></div>
                </div>
              )}
            </div>
            

            
          </div>

          {/* Duration Selection */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-300">
                Stake Duration
              </label>
              <span className="text-sm text-purple-400 font-medium">
                {selectedDuration?.label || 'Select duration'}
              </span>
            </div>
            
            <div className="relative">
              <input
                type="range"
                min="0"
                max={durations.length - 1}
                value={selectedDurationIndex > -1 ? selectedDurationIndex : 0}
                onChange={handleDurationSliderChange}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                disabled={!alphaIsConnected || contextLoading.transaction}
                style={{
                  background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(selectedDurationIndex / (durations.length - 1)) * 100}%, #374151 ${(selectedDurationIndex / (durations.length - 1)) * 100}%, #374151 100%)`
                }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <button
                type="button"
                className="hover:text-purple-400 transition-colors"
                onClick={() => {
                  if (durations && durations.length > 0 && durations[0]) {
                    setSelectedDuration(durations[0]);
                  }
                }}
              >
                Shortest
              </button>
              <button
                type="button"
                className="hover:text-purple-400 transition-colors"
                onClick={() => {
                  if (durations && durations.length > 0 && durations[durations.length - 1]) {
                    setSelectedDuration(durations[durations.length - 1]);
                  }
                }}
              >
                Longest
              </button>
            </div>
          </div>
        </div>

        {/* APY and Rewards Estimation */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-center mb-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">APY Rate:</span>
                <span className="text-sm font-bold text-emerald-400">{selectedDuration?.apy || 0}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">Duration:</span>
                <span className="text-sm font-bold text-blue-400">{selectedDuration?.days || 0} days</span>
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Estimated Rewards:</span>
              <span className="text-xs font-medium text-white">
                {(() => {
                  const amountNum = parseFloat(amount);
                  if (!isNaN(amountNum) && amountNum > 0 && selectedDuration) {
                    const pointsPerDayPerSui = calculateAlphaPointsPerDayPerSui(selectedDuration.apy);
                    const EPOCHS_PER_DAY = 1;
                    const durationDays = selectedDuration.days;

                    const totalEpochs = durationDays * EPOCHS_PER_DAY;
                    const totalAlphaPointsRewards = amountNum * pointsPerDayPerSui * totalEpochs;
                    const alphaPointsPerEpoch = amountNum * pointsPerDayPerSui;

                    const formattedTotalAlphaPoints = totalAlphaPointsRewards.toLocaleString(undefined, {maximumFractionDigits: 0});
                    const formattedAlphaPointsPerEpoch = alphaPointsPerEpoch.toLocaleString(undefined, {maximumFractionDigits: 0});

                    return `~${formattedTotalAlphaPoints} αP (${formattedAlphaPointsPerEpoch} αP/day)`;
                  }
                  return 'Enter an amount to see rewards';
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={handleStake}
            disabled={ 
                !alphaIsConnected || 
                (!amount || !(parseFloat(amount) >= 1.0)) ||
                !checkSufficientBalance() ||
                isLoadingBalance ||
                (stakingStage !== 'idle' && stakingStage !== 'failed' && stakingStage !== 'success')
            }
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 relative"
          >
            {(stakingStage === 'requestingStake' || stakingStage === 'registeringStake' || stakingStage === 'fetchingProof') ? (
              <>
                <span className="opacity-0">{getButtonLabel()}</span> 
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{getButtonLabel()}</span>
                </span>
              </>
            ) : (
              'Stake SUI'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};