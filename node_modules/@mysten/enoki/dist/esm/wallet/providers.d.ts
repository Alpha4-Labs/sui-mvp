import type { Wallet } from '@mysten/wallet-standard';
import type { AuthProvider } from '../EnokiClient/type.js';
export declare const ENOKI_PROVIDER_WALLETS_INFO: {
    name: string;
    icon: Wallet['icon'];
    provider: AuthProvider;
}[];
