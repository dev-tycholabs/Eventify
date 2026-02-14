import { verifyMessage } from "viem";

export interface WalletVerification {
    address: string;
    message: string;
    signature: `0x${string}`;
}

// Standard message format for wallet verification
export function createSignMessage(address: string, nonce: string): string {
    return `Sign this message to verify your wallet ownership.\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
}

// Verify that a signature was signed by the claimed address
export async function verifyWalletSignature({
    address,
    message,
    signature,
}: WalletVerification): Promise<boolean> {
    try {
        const isValid = await verifyMessage({
            address: address as `0x${string}`,
            message,
            signature,
        });
        return isValid;
    } catch (error) {
        console.error("Signature verification failed:", error);
        return false;
    }
}

// Simple nonce generator (in production, store these in DB with expiry)
export function generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}
