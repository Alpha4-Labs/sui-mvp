type AwsRequestInit = RequestInit & {
    aws?: {
        accessKeyId?: string;
        secretAccessKey?: string;
        sessionToken?: string;
        service?: string;
        region?: string;
        cache?: Map<string, ArrayBuffer>;
        datetime?: string;
        signQuery?: boolean;
        appendSessionToken?: boolean;
        allHeaders?: boolean;
        singleEncode?: boolean;
    };
};
export declare class AwsClient {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string | undefined;
    service: string | undefined;
    region: string | undefined;
    cache: Map<any, any>;
    retries: number;
    initRetryMs: number;
    /**
     * @param {} options
     */
    constructor({ accessKeyId, secretAccessKey, sessionToken, service, region, cache, retries, initRetryMs, }: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        service?: string;
        region?: string;
        cache?: Map<string, ArrayBuffer>;
        retries?: number;
        initRetryMs?: number;
    });
    sign(input: Request | {
        toString: () => string;
    }, init: AwsRequestInit): Promise<Request>;
    /**
     * @param {Request | { toString: () => string }} input
     * @param {?AwsRequestInit} [init]
     * @returns {Promise<Response>}
     */
    fetch(input: Request | {
        toString: () => string;
    }, init: AwsRequestInit): Promise<Response>;
}
export declare class AwsV4Signer {
    method: any;
    url: URL;
    headers: Headers;
    body: any;
    accessKeyId: any;
    secretAccessKey: any;
    sessionToken: any;
    service: any;
    region: any;
    cache: any;
    datetime: any;
    signQuery: any;
    appendSessionToken: any;
    signableHeaders: any[];
    signedHeaders: any;
    canonicalHeaders: any;
    credentialString: string;
    encodedPath: string;
    encodedSearch: string;
    /**
     * @param {} options
     */
    constructor({ method, url, headers, body, accessKeyId, secretAccessKey, sessionToken, service, region, cache, datetime, signQuery, appendSessionToken, allHeaders, singleEncode, }: {
        method?: string;
        url: string;
        headers?: HeadersInit;
        body?: BodyInit | null;
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        service?: string;
        region?: string;
        cache?: Map<string, ArrayBuffer>;
        datetime?: string;
        signQuery?: boolean;
        appendSessionToken?: boolean;
        allHeaders?: boolean;
        singleEncode?: boolean;
    });
    /**
     * @returns {Promise<{
     *   method: string
     *   url: URL
     *   headers: Headers
     *   body?: BodyInit | null
     * }>}
     */
    sign(): Promise<{
        method: any;
        url: URL;
        headers: Headers;
        body: any;
    }>;
    /**
     * @returns {Promise<string>}
     */
    authHeader(): Promise<string>;
    /**
     * @returns {Promise<string>}
     */
    signature(): Promise<string>;
    /**
     * @returns {Promise<string>}
     */
    stringToSign(): Promise<string>;
    /**
     * @returns {Promise<string>}
     */
    canonicalString(): Promise<string>;
    /**
     * @returns {Promise<string>}
     */
    hexBodyHash(): Promise<string>;
}
export {};
