import type { ReactNode } from 'react';
import type { EnokiFlowConfig } from './EnokiFlow.js';
import { EnokiFlow } from './EnokiFlow.js';
/** @deprecated use `registerEnokiWallets` instead */
export type EnokiFlowProviderProps = EnokiFlowConfig & {
    children: ReactNode;
};
/** @deprecated use `registerEnokiWallets` instead */
export declare function EnokiFlowProvider({ children, ...config }: EnokiFlowProviderProps): import("react/jsx-runtime.js").JSX.Element;
/** @deprecated use `registerEnokiWallets` and dapp-kit wallet hooks instead */
export declare function useEnokiFlow(): EnokiFlow;
/** @deprecated use `registerEnokiWallets` and dapp-kit wallet hooks instead */
export declare function useZkLogin(): import("./EnokiFlow.js").ZkLoginState;
/** @deprecated use `registerEnokiWallets` and dapp-kit wallet hooks instead */
export declare function useZkLoginSession(): import("./EnokiFlow.js").ZkLoginSession | null;
/** @deprecated use `registerEnokiWallets` and dapp-kit wallet hooks instead */
export declare function useAuthCallback(): {
    handled: boolean;
    state: string | null;
};
