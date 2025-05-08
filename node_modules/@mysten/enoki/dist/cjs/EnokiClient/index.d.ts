import type { CreateSponsoredTransactionApiInput, CreateSponsoredTransactionApiResponse, CreateSubnameApiInput, CreateSubnameApiResponse, CreateZkLoginNonceApiInput, CreateZkLoginNonceApiResponse, CreateZkLoginZkpApiInput, CreateZkLoginZkpApiResponse, DeleteSubnameApiInput, ExecuteSponsoredTransactionApiInput, ExecuteSponsoredTransactionApiResponse, GetAppApiInput, GetAppApiResponse, GetSubnamesApiInput, GetSubnamesApiResponse, GetZkLoginAddressesApiInput, GetZkLoginAddressesApiResponse, GetZkLoginApiInput, GetZkLoginApiResponse } from './type.js';
export interface EnokiClientConfig {
    /** The API key for the Enoki app, available in the Enoki Portal. */
    apiKey: string;
    /** The API URL for Enoki. In most cases, this should not be set. */
    apiUrl?: string;
}
export declare class EnokiClientError extends Error {
    errors: {
        code: string;
        message: string;
        data: unknown;
    }[];
    status: number;
    code: string;
    constructor(status: number, response: string);
}
/**
 * A low-level client for interacting with the Enoki API.
 */
export declare class EnokiClient {
    #private;
    constructor(config: EnokiClientConfig);
    getApp(_input?: GetAppApiInput): Promise<GetAppApiResponse>;
    getZkLogin(input: GetZkLoginApiInput): Promise<GetZkLoginApiResponse>;
    getZkLoginAddresses(input: GetZkLoginAddressesApiInput): Promise<GetZkLoginAddressesApiResponse>;
    createZkLoginNonce(input: CreateZkLoginNonceApiInput): Promise<CreateZkLoginNonceApiResponse>;
    createZkLoginZkp(input: CreateZkLoginZkpApiInput): Promise<CreateZkLoginZkpApiResponse>;
    createSponsoredTransaction(input: CreateSponsoredTransactionApiInput): Promise<CreateSponsoredTransactionApiResponse>;
    executeSponsoredTransaction(input: ExecuteSponsoredTransactionApiInput): Promise<ExecuteSponsoredTransactionApiResponse>;
    getSubnames(input: GetSubnamesApiInput): Promise<GetSubnamesApiResponse>;
    createSubname(input: CreateSubnameApiInput): Promise<CreateSubnameApiResponse>;
    deleteSubname(input: DeleteSubnameApiInput): void;
}
