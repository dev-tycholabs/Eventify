"use client";

import { useState, useCallback, useEffect } from "react";
import { createPublicClient, http, formatEther } from "viem";
import { useAccount } from "wagmi";
import {
    SUPPORTED_CHAINS,
    CHAIN_CONTRACTS,
    getNativeCurrencySymbol,
} from "@/config/chains";
import { TicketMarketplaceABI } from "./contracts";

const NATIVE_CURRENCY = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa" as `0x${string}`;

export interface ChainBalance {
    chainId: number;
    chainName: string;
    currencySymbol: string;
    balance: bigint;
    formatted: string;
    loading: boolean;
    error: boolean;
}

// Cache public clients per chain
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCache = new Map<number, any>();

function getClient(chainId: number) {
    if (clientCache.has(chainId)) return clientCache.get(chainId)!;
    const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
    if (!chain) return null;
    const client = createPublicClient({ chain, transport: http() });
    clientCache.set(chainId, client as any);
    return client;
}

export function useMultiChainBalances() {
    const { address, isConnected } = useAccount();
    const [balances, setBalances] = useState<ChainBalance[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchAll = useCallback(async () => {
        if (!address) return;
        setLoading(true);

        // Build initial state for all chains that have contracts
        const chains = SUPPORTED_CHAINS.filter((c) => CHAIN_CONTRACTS[c.id]);

        const initial: ChainBalance[] = chains.map((c) => ({
            chainId: c.id,
            chainName: c.name,
            currencySymbol: getNativeCurrencySymbol(c.id),
            balance: BigInt(0),
            formatted: "0.0000",
            loading: true,
            error: false,
        }));
        setBalances(initial);

        const results = await Promise.allSettled(
            chains.map(async (chain) => {
                const client = getClient(chain.id);
                const contracts = CHAIN_CONTRACTS[chain.id];
                if (!client || !contracts) throw new Error("no client");

                const balance = (await client.readContract({
                    address: contracts.TicketMarketplace,
                    abi: TicketMarketplaceABI,
                    functionName: "claimableFunds",
                    args: [address, NATIVE_CURRENCY],
                })) as bigint;

                return { chainId: chain.id, balance };
            })
        );

        setBalances((prev) =>
            prev.map((entry, i) => {
                const result = results[i];
                if (result.status === "fulfilled") {
                    const bal = result.value.balance;
                    return {
                        ...entry,
                        balance: bal,
                        formatted: parseFloat(formatEther(bal)).toFixed(4),
                        loading: false,
                        error: false,
                    };
                }
                return { ...entry, loading: false, error: true };
            })
        );

        setLoading(false);
    }, [address]);

    useEffect(() => {
        if (isConnected && address) {
            fetchAll();
        }
    }, [isConnected, address, fetchAll]);

    const totalHasClaimable = balances.some((b) => b.balance > BigInt(0));

    return { balances, loading, refresh: fetchAll, totalHasClaimable };
}
