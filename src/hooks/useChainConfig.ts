"use client";

import { useAccount } from "wagmi";
import {
    DEFAULT_CHAIN,
    getContractsForChain,
    getExplorerUrl,
    getNativeCurrencySymbol,
    type ChainContracts,
} from "@/config/chains";

/**
 * Returns chain-aware configuration based on the currently connected chain.
 * Falls back to DEFAULT_CHAIN when wallet is disconnected or on an unsupported chain.
 */
export function useChainConfig() {
    const { chain } = useAccount();
    const chainId = chain?.id ?? DEFAULT_CHAIN.id;

    const contracts: ChainContracts | null = getContractsForChain(chainId);
    const explorerUrl: string = getExplorerUrl(chainId);
    const currencySymbol: string = getNativeCurrencySymbol(chainId);

    // Whether the current chain has deployed contracts
    const isSupported = contracts !== null;

    return {
        chainId,
        chain: chain ?? DEFAULT_CHAIN,
        contracts,
        explorerUrl,
        currencySymbol,
        isSupported,
    };
}
