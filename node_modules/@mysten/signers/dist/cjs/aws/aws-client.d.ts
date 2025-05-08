import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import { AwsClient } from './aws4fetch.js';
interface KmsCommands {
    Sign: {
        request: {
            KeyId: string;
            Message: string;
            MessageType: 'RAW' | 'DIGEST';
            SigningAlgorithm: 'ECDSA_SHA_256';
        };
        response: {
            KeyId: string;
            KeyOrigin: string;
            Signature: string;
            SigningAlgorithm: string;
        };
    };
    GetPublicKey: {
        request: {
            KeyId: string;
        };
        response: {
            CustomerMasterKeySpec: string;
            KeyId: string;
            KeyOrigin: string;
            KeySpec: string;
            KeyUsage: string;
            PublicKey: string;
            SigningAlgorithms: string[];
        };
    };
}
export interface AwsClientOptions extends Partial<ConstructorParameters<typeof AwsClient>[0]> {
}
export declare class AwsKmsClient extends AwsClient {
    constructor(options?: AwsClientOptions);
    getPublicKey(keyId: string): Promise<Secp256r1PublicKey | Secp256k1PublicKey>;
    runCommand<T extends keyof KmsCommands>(command: T, body: KmsCommands[T]['request'], { region, }?: {
        region?: string;
    }): Promise<KmsCommands[T]['response']>;
}
export {};
