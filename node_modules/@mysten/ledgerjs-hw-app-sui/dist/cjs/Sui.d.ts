import type Transport from '@ledgerhq/hw-transport';
export type GetPublicKeyResult = {
    publicKey: Uint8Array;
    address: Uint8Array;
};
export type SignTransactionResult = {
    signature: Uint8Array;
};
export type GetVersionResult = {
    major: number;
    minor: number;
    patch: number;
};
/**
 * Sui API
 *
 * @example
 * import Sui from "@mysten/ledgerjs-hw-app-sui";
 * const sui = new Sui(transport)
 */
export default class Sui {
    #private;
    transport: Transport;
    constructor(transport: Transport, scrambleKey?: string, verbose?: boolean);
    /**
     * Retrieves the public key associated with a particular BIP32 path from the Ledger app.
     *
     * @param path - the path to retrieve.
     * @param displayOnDevice - whether or not the address should be displayed on the device.
     *
     */
    getPublicKey(path: string, displayOnDevice?: boolean): Promise<GetPublicKeyResult>;
    /**
     * Sign a transaction with the key at a BIP32 path.
     *
     * @param txn - The transaction bytes to sign.
     * @param path - The path to use when signing the transaction.
     * @param options - Additional options used for clear signing purposes.
     */
    signTransaction(path: string, txn: Uint8Array, options?: {
        bcsObjects: Uint8Array[];
    }): Promise<SignTransactionResult>;
    /**
     * Retrieve the app version on the attached Ledger device.
     */
    getVersion(): Promise<GetVersionResult>;
}
