import { createPublicClient, http, type PublicClient } from "viem";
import { SUPPORTED_CHAINS } from "@/config/chains";
import { EventTicketABI } from "@/hooks/contracts";

export interface MultiChainVerifyResult {
    chainId: number;
    isValid: boolean;
    holder: `0x${string}`;
    isUsed: boolean;
    eventName?: string;
    eventVenue?: string;
    eventDate?: Date;
}

// Cache public clients so we don't recreate them on every call
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCache = new Map<number, any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPublicClient(chainId: number): any {
    if (clientCache.has(chainId)) return clientCache.get(chainId)!;

    const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
    if (!chain) return null;

    const client = createPublicClient({
        chain,
        transport: http(),
    });
    clientCache.set(chainId, client);
    return client;
}

/**
 * Verify a ticket across chains. If hintChainId is provided, tries that chain first.
 * Falls back to trying all supported chains in parallel.
 */
export async function verifyTicketMultiChain(
    contractAddress: `0x${string}`,
    tokenId: bigint,
    hintChainId?: number
): Promise<MultiChainVerifyResult> {
    // If we have a hint, try that chain first
    if (hintChainId) {
        const result = await tryVerifyOnChain(hintChainId, contractAddress, tokenId);
        if (result) return result;
    }

    // Try all other chains in parallel
    const otherChains = SUPPORTED_CHAINS.filter((c) => c.id !== hintChainId);
    const results = await Promise.allSettled(
        otherChains.map((chain) => tryVerifyOnChain(chain.id, contractAddress, tokenId))
    );

    for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
            return result.value;
        }
    }

    throw new Error("TicketNotFoundOnAnyChain");
}

async function tryVerifyOnChain(
    chainId: number,
    contractAddress: `0x${string}`,
    tokenId: bigint
): Promise<MultiChainVerifyResult | null> {
    const client = getPublicClient(chainId);
    if (!client) return null;

    try {
        const verifyResult = await client.readContract({
            address: contractAddress,
            abi: EventTicketABI,
            functionName: "verifyTicket",
            args: [tokenId],
        });

        const [isValid, holder, isUsed] = verifyResult as [boolean, `0x${string}`, boolean];

        // Fetch event details
        let eventName: string | undefined;
        let eventVenue: string | undefined;
        let eventDate: Date | undefined;

        try {
            const eventDetails = await client.readContract({
                address: contractAddress,
                abi: EventTicketABI,
                functionName: "getEventDetails",
            });
            const details = eventDetails as [string, string, bigint, bigint, bigint, bigint, `0x${string}`];
            eventName = details[0];
            eventVenue = details[1];
            eventDate = new Date(Number(details[2]) * 1000);
        } catch {
            // Non-critical
        }

        return { chainId, isValid, holder, isUsed, eventName, eventVenue, eventDate };
    } catch {
        return null;
    }
}
