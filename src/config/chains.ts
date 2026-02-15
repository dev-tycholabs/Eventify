import { defineChain } from "viem";
import { sepolia } from "viem/chains";

// ─── Custom chain definitions ───────────────────────────────────────────────

export const etherlinkTestnet = defineChain({
    id: 128123,
    name: "Etherlink Testnet",
    nativeCurrency: {
        decimals: 18,
        name: "XTZ",
        symbol: "XTZ",
    },
    rpcUrls: {
        default: { http: ["https://node.ghostnet.etherlink.com"] },
    },
    blockExplorers: {
        default: {
            name: "Etherlink Explorer",
            url: "https://testnet.explorer.etherlink.com",
        },
    },
    testnet: true,
});

export const etherlinkShadownet = defineChain({
    id: 127823,
    name: "Etherlink Shadownet",
    nativeCurrency: {
        decimals: 18,
        name: "XTZ",
        symbol: "XTZ",
    },
    rpcUrls: {
        default: { http: ["https://rpc.ankr.com/etherlink_shadownet_testnet/2135afba8b48f4f1701817fbf369fd1388798385298a736c0009a1dccd638770"] },
    },
    blockExplorers: {
        default: {
            name: "Shadownet Explorer",
            url: "https://shadownet.explorer.etherlink.com",
        },
    },
    testnet: true,
});

// ─── Per-chain contract addresses ───────────────────────────────────────────

export interface ChainContracts {
    EventFactory: `0x${string}`;
    TicketMarketplace: `0x${string}`;
    Registry: `0x${string}`;
    RoyaltySplitterImpl: `0x${string}`;
}

// Map of chain ID → deployed contract addresses
// Add entries here as you deploy contracts to new chains
export const CHAIN_CONTRACTS: Record<number, ChainContracts> = {
    // Etherlink Shadownet (current deployment)
    [etherlinkShadownet.id]: {
        EventFactory: "0x6885809b6894B8Dfa5BA92f01fEd1031E96007Ae",
        TicketMarketplace: "0xFBC5f575A39D97a15545F095B92fA23BAa3ea075",
        Registry: "0xDb3B9b7AC97D51D825aA43733D3f4aA49fe8B4Da",
        RoyaltySplitterImpl: "0x9273391df6651941Fd02a674A5FB849e721F0094",
    },
    // Etherlink Testnet — deploy contracts and fill in addresses
    // [etherlinkTestnet.id]: {
    //     EventFactory: "0x...",
    //     TicketMarketplace: "0x...",
    //     Registry: "0x...",
    //     RoyaltySplitterImpl: "0x...",
    // },
    // Sepolia
    [sepolia.id]: {
        EventFactory: "0xCeb9d92a823A2BE3aECA6d882764502e5a03cafD",
        TicketMarketplace: "0x5991553521B100dEC25Af22067377Ca37752D67c",
        Registry: "0xC1478b5dfb5D04B6FcdD0FF5c4ef366c80A3A424",
        RoyaltySplitterImpl: "0xDE542c4b4A961f91DAB6723Eb2F67124D2EEdA9C",
    },
};

// ─── Supported chains list (order = display order in wallet switcher) ───────

export const SUPPORTED_CHAINS = [
    etherlinkShadownet,
    sepolia,
    // Uncomment as you deploy contracts:
    // etherlinkTestnet,
    // baseSepolia,
    // arbitrumSepolia,
] as const;

// Default chain (first in the list)
export const DEFAULT_CHAIN = SUPPORTED_CHAINS[0];

// ─── Helper: get explorer URL for a chain ───────────────────────────────────

export function getExplorerUrl(chainId: number): string {
    const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
    return chain?.blockExplorers?.default?.url ?? "";
}

// ─── Helper: get native currency symbol for a chain ─────────────────────────

export function getNativeCurrencySymbol(chainId: number): string {
    const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
    return chain?.nativeCurrency?.symbol ?? "ETH";
}

// ─── Helper: get contract addresses for a chain ─────────────────────────────

export function getContractsForChain(chainId: number): ChainContracts | null {
    return CHAIN_CONTRACTS[chainId] ?? null;
}
