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
import { formatSui } from '../utils/format';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair, Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import {
  SuiTransactionBlockResponse, 
  SuiObjectChangeCreated, 
  SuiClient,
  ExecuteTransactionRequestType
} from '@mysten/sui/client';
// For Sui SDK v1.0+ ZkLoginSignatureInputs are often directly available or part of ZkLoginSignature
import { 
    getZkLoginSignature, 
    ZkLoginSignatureInputs as ActualZkLoginSignatureInputs,
    // fetchZkLoginProver, // Not exported directly it seems
    ZkLoginPublicIdentifier, // May need this for reconstructing pubkey
    // publicKeyFromSerialized // Not exported directly
} from '@mysten/sui/zklogin'; 
import { Buffer } from 'buffer/';
import bs58 from 'bs58';
// import { IntentScope } from '@mysten/sui/client'; // REMOVE THIS LINE
// import { jwtDecode } from "jwt-decode"; // Changed to named import

// --- Validator List ---
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

// --- Constants ---
// const PROVER_URL = 'https://prover.mystenlabs.com/v1'; // REMOVE THIS LINE

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
    loading: { suiBalance: isLoadingBalance }
  } = useAlphaContext();

  const suiClient = useSuiClient();

  const [amount, setAmount] = useState('');
  const [currentlyStaked] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State for validator selection
  const [validatorSelectionMode, setValidatorSelectionMode] = useState<'auto' | 'manual'>('auto');
  const [selectedValidatorAddress, setSelectedValidatorAddress] = useState<string>(validators[0].address);

  // State for multi-stage staking process
  const [stakingStage, setStakingStage] = useState<StakingStage>('idle');
  const [stakedSuiId, setStakedSuiId] = useState<string | null>(null);
  const [txDigest1, setTxDigest1] = useState<string | null>(null);
  const [txDigest2, setTxDigest2] = useState<string | null>(null);

  // Revert to default useSignAndExecuteTransaction (no custom execute)
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction(); 

  // --- Effects ---
  useEffect(() => {
    if (alphaIsConnected) {
      setError(null);
    }
  }, [alphaIsConnected]);

  useEffect(() => {
    // Update global loading state based on staking stage
    setTransactionLoading(stakingStage === 'requestingStake' || stakingStage === 'registeringStake');
  }, [stakingStage, setTransactionLoading]);

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

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) return setError("Please enter a valid positive amount");

    const amountInMist = BigInt(Math.floor(amountFloat * 1_000_000_000));
    const availableInMist = BigInt(suiBalance);
    const gasBuffer = BigInt(10_000_000); 
    const minStakeSuiSystem = BigInt(1_000_000_000); // 1 SUI for sui_system::request_add_stake
    
    if (amountInMist < minStakeSuiSystem) return setError(`Minimum stake amount for native staking is ${formatSui(minStakeSuiSystem.toString())} SUI`);
    if (amountInMist + gasBuffer > availableInMist) return setError("Insufficient balance for stake amount plus gas fee buffer (0.01 SUI).");

    let validatorAddressToUse: string;
    if (validatorSelectionMode === 'auto') {
      const randomIndex = Math.floor(Math.random() * validators.length);
      validatorAddressToUse = validators[randomIndex].address;
    } else {
      if (!selectedValidatorAddress) return setError("Please select a validator in Manual mode.");
      validatorAddressToUse = selectedValidatorAddress;
    }
   
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
                    'Authorization': `Bearer ${import.meta.env.VITE_ENOKI_KEY}`,
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
        throw new Error("Failed to identify the StakedSui object created by Tx1.");
      }
      setStakedSuiId(newStakedSuiId);

    } catch (error: any) {
      console.error('Error during Tx1 preparation/execution:', error);
      setError(getTransactionErrorMessage(error));
      setStakingStage('failed');
      return;
    }

    if (!newStakedSuiId) {
        setError("Internal error: StakedSui ID missing before Tx2.");
        setStakingStage('failed');
      return;
    }

    setStakingStage('registeringStake');
    let tx2Digest: string | null = null;

    try {
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

        const VITE_ENOKI_KEY_TX2 = import.meta.env.VITE_ENOKI_KEY;
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
      setSuccess(`Successfully staked ${formatSui(amountInMist.toString())} SUI! Tx1: ${tx1Digest?.substring(0,6)}..., Tx2: ${tx2Digest?.substring(0,6)}...`);
      setAmount('');
      
      refreshData();

    } catch (error: any) {
      console.error('Error during Tx2:', error);
      setError(getTransactionErrorMessage(error));
      setStakingStage('failed');
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
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Manage Stake</h2>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-md text-red-400 text-sm break-words">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-md text-green-400 text-sm break-words">
          {success}
          {txDigest1 && <div className="mt-1 text-xs">Tx1 Digest: <a href={`https://suiscan.xyz/testnet/tx/${txDigest1}`} target="_blank" rel="noopener noreferrer" className="underline">{txDigest1.substring(0, 10)}...</a></div>}
          {txDigest2 && <div className="mt-1 text-xs">Tx2 Digest: <a href={`https://suiscan.xyz/testnet/tx/${txDigest2}`} target="_blank" rel="noopener noreferrer" className="underline">{txDigest2.substring(0, 10)}...</a></div>}
        </div>
      )}

      <div className="space-y-4">
        {/* Available Balance Display */}
        <div className="bg-background rounded-lg p-3 flex justify-between items-center">
          <span className="text-gray-400 text-sm">Available Balance:</span>
          {isLoadingBalance ? (
            <span className="text-white text-sm animate-pulse">Loading...</span>
          ) : (
            <span className="text-white text-sm font-medium">{formatSui(suiBalance)} SUI</span>
          )}
        </div>

        {/* Stake Amount Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="stake-amount" className="text-gray-400 text-sm">Amount to Stake (SUI)</label>
            <button
              type="button"
              onClick={() => {
                if (suiBalance && !isLoadingBalance) {
                  const availableInSui = parseFloat(suiBalance) / 1_000_000_000;
                  const gasBufferInSui = 0.01; // 0.01 SUI
                  const maxPossible = Math.max(0, availableInSui - gasBufferInSui);
                  const minStakeSui = 1.0;
                  
                  if (maxPossible >= minStakeSui) {
                    // Format with proper precision avoiding scientific notation
                    setAmount(maxPossible.toFixed(9).replace(/\.?0+$/, ''));
                  } else {
                    setAmount('');
                    setError(`Insufficient balance. You need at least ${minStakeSui + gasBufferInSui} SUI.`);
                  }
                }
              }}
              className="text-xs text-primary hover:text-primary-dark transition-colors"
              disabled={!alphaIsConnected || isLoadingBalance || contextLoading.transaction}
            >
              Max
            </button>
          </div>
          <div className="relative">
            <input
              id="stake-amount"
              type="text"
              inputMode="decimal"
              pattern="^[0-9]*[.,]?[0-9]*$"
              value={amount}
              onChange={(e) => {
                // Accept only valid numeric input with one decimal point
                const value = e.target.value.replace(',', '.');
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value);
                }
              }}
              placeholder="0.0"
              className="w-full bg-background-input rounded p-3 text-white border border-gray-600 focus:border-primary focus:ring-primary pr-16"
              aria-label="Amount to Stake in SUI"
              disabled={!alphaIsConnected || contextLoading.transaction}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              SUI
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Currently Staked: {formatSui(currentlyStaked)} SUI</span>
            <span>Min: 1.00 SUI</span>
          </div>
        </div>

        {/* Validator Selection */}
        <div>
          <label className="block text-gray-400 mb-2 text-sm">Validator Selection</label>
          <div className="flex items-center space-x-4 bg-background-input p-3 rounded-md border border-gray-600">
            <span className="text-gray-400 text-sm">Mode:</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setValidatorSelectionMode('auto')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  validatorSelectionMode === 'auto' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                disabled={contextLoading.transaction || !alphaIsConnected}
              >
                Auto
              </button>
              <button
                onClick={() => setValidatorSelectionMode('manual')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  validatorSelectionMode === 'manual' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                disabled={contextLoading.transaction || !alphaIsConnected}
              >
                Manual
              </button>
            </div>
          </div>
          {validatorSelectionMode === 'manual' && (
            <div className="mt-2 relative">
              <select
                value={selectedValidatorAddress}
                onChange={(e) => setSelectedValidatorAddress(e.target.value)}
                className="w-full bg-background-input rounded p-3 text-white border border-gray-600 focus:border-primary focus:ring-primary appearance-none pr-8"
                disabled={contextLoading.transaction || !alphaIsConnected}
                aria-label="Select Validator"
              >
                {validators.map((validator) => (
                  <option key={validator.address} value={validator.address}>
                    {validator.name} ({validator.address.substring(0, 6)}...{validator.address.substring(validator.address.length - 4)})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          )}
           <div className="text-xs text-gray-500 mt-1 italic">
            Auto mode randomly selects a validator from the list. Manual mode lets you choose.
          </div>
        </div>

        {/* Duration Selection */}
        <div>
          <label className="block text-gray-400 mb-2 text-sm">Stake Duration</label>
          <div className="grid grid-cols-3 gap-2">
            {durations.map((duration) => (
              <button
                key={duration.days}
                className={`py-2 px-3 rounded-md text-sm transition-colors ${
                  selectedDuration.days === duration.days
                    ? 'bg-primary text-white font-medium ring-2 ring-primary-focus'
                    : 'bg-background-input text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setSelectedDuration(duration)}
                disabled={!alphaIsConnected || contextLoading.transaction}
              >
                {duration.label}
              </button>
            ))}
          </div>

          {/* APY and Rewards Estimation */}
          <div className="mt-3 p-3 bg-background rounded-lg">
            <div className="flex justify-between mb-1">
              <span className="text-gray-400 text-sm">Est. APY Rate:</span>
              <span className="text-green-400 text-sm font-medium">{selectedDuration.apy}%</span>
            </div>
            {(() => {
              const amountNum = parseFloat(amount);
              if (!isNaN(amountNum) && amountNum > 0) {
                const apyRate = selectedDuration.apy / 100;
                const days = selectedDuration.days;
                const estRewards = amountNum * apyRate * (days / 365);
                const formattedRewards = isFinite(estRewards) 
                  ? formatSui(estRewards.toString(), 4) 
                  : '0';
                
                return (
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Est. Rewards:</span>
                    <span className="text-white text-sm">
                     ~{formattedRewards} SUI
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleStake}
            disabled={ 
                !alphaIsConnected || 
                !amount || 
                !(parseFloat(amount) >= 1.0) ||
                isLoadingBalance ||
                (stakingStage !== 'idle' && stakingStage !== 'failed' && stakingStage !== 'success') // Disable if mid-process
            }
            className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
          >
            {(stakingStage === 'requestingStake' || stakingStage === 'registeringStake' || stakingStage === 'fetchingProof') ? (
              <>
                <span className="opacity-0">{getButtonLabel()}</span> 
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-2">{getButtonLabel()}</span>
                </span>
              </>
            ) : (
              getButtonLabel()
            )}
          </button>

          {/* Unstake button - disabled here */}
          <button
            disabled
            className="flex-1 bg-transparent border border-gray-600 text-gray-500 py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unstake
          </button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 mt-2 italic">
          Note: Staking locks your SUI for the selected duration. Early unstaking is available via Alpha Points loans.
        </div>
      </div>
    </div>
  );
};