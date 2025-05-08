import type { ZkLoginSignatureInputs } from '@mysten/sui/zklogin';
import type { WritableAtom } from 'nanostores';
import type { Encryption } from './encryption.js';
import type { EnokiClientConfig } from './EnokiClient/index.js';
import { EnokiClient } from './EnokiClient/index.js';
import type { AuthProvider, EnokiNetwork } from './EnokiClient/type.js';
import { EnokiKeypair } from './EnokiKeypair.js';
import type { SyncStore } from './stores.js';
/**
 * @deprecated Use `RegisterEnokiWalletsOptions` instead
 */
export type EnokiFlowConfig = EnokiClientConfig & ({
    experimental_nativeCryptoSigner?: unknown;
    /**
     * The storage interface to persist Enoki data locally.
     * If not provided, it will use a sessionStorage-backed store.
     */
    store?: SyncStore;
    /**
     * The encryption interface that will be used to encrypt data before storing it locally.
     * If not provided, it will use a default encryption interface.
     */
    encryption?: Encryption;
} | {
    store?: never;
    encryption?: never;
    /**
     * Enables the new native crypto signer for the EnokiFlow, which is more secure.
     */
    experimental_nativeCryptoSigner: true;
});
export interface ZkLoginState {
    provider?: AuthProvider;
    address?: string;
    salt?: string;
    publicKey?: string;
}
export interface ZkLoginSession {
    ephemeralKeyPair: string;
    maxEpoch: number;
    randomness: string;
    expiresAt: number;
    jwt?: string;
    proof?: ZkLoginSignatureInputs;
}
/**
 * @deprecated Use `registerEnokiWallets` instead
 */
export declare class EnokiFlow {
    #private;
    $zkLoginSession: WritableAtom<{
        initialized: boolean;
        value: ZkLoginSession | null;
    }>;
    $zkLoginState: WritableAtom<ZkLoginState>;
    constructor(config: EnokiFlowConfig);
    get enokiClient(): EnokiClient;
    createAuthorizationURL(input: {
        provider: AuthProvider;
        clientId: string;
        redirectUrl: string;
        network?: 'mainnet' | 'testnet' | 'devnet';
        extraParams?: Record<string, unknown>;
    }): Promise<string>;
    handleAuthCallback(hash?: string): Promise<string | null>;
    getSession(): Promise<ZkLoginSession | null>;
    logout(): Promise<void>;
    getProof({ network }?: {
        network?: EnokiNetwork;
    }): Promise<import("./EnokiClient/type.js").CreateZkLoginZkpApiResponse>;
    getKeypair({ network }?: {
        network?: EnokiNetwork;
    }): Promise<EnokiKeypair>;
}
