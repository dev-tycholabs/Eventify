import { sepolia, avalancheFuji, polygonAmoy, baseSepolia, optimismSepolia, etherlinkShadownetTestnet, unichainSepolia } from "viem/chains";

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
    [etherlinkShadownetTestnet.id]: {
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
    // Avalanche Fuji
    [avalancheFuji.id]: {
        EventFactory: "0x167582d206972f9b053D3e9Ec2CFA945Ab2b5bf6",
        TicketMarketplace: "0x053E1951307B0f9f87E6054E87754D877306386c",
        Registry: "0xa0FfD7DAE3c011E737fc1326cACD1b784278A721",
        RoyaltySplitterImpl: "0x408DfB52e37539C639618BC28AeBD933E878ef77",
    },
    // Polygon Amoy
    [polygonAmoy.id]: {
        EventFactory: "0x408DfB52e37539C639618BC28AeBD933E878ef77",
        TicketMarketplace: "0xa0FfD7DAE3c011E737fc1326cACD1b784278A721",
        Registry: "0x322eC36AD2F8257cc312d0Cc9550afB6eD9e945A",
        RoyaltySplitterImpl: "0x053E1951307B0f9f87E6054E87754D877306386c",
    },
    // Base Sepolia
    [baseSepolia.id]: {
        EventFactory: "0x8aB53d30Db4043f4ee0f43564B6595B3D3BC092E",
        TicketMarketplace: "0x1F350D999Db98BF7DCb51b231ef992AeBA8aacAA",
        Registry: "0xF653f0cA2205366283Ce28f0CE2018b47D8A9995",
        RoyaltySplitterImpl: "0x7a7365b0709de89d1Cf8fEB11BC0Aa8207486204",
    },
    // Optimism Sepolia
    [optimismSepolia.id]: {
        EventFactory: "0x64fFDeE582187975b84E7Bba189D380D2289Dd6E",
        TicketMarketplace: "0x403D7d92024Cb6Be2Ff71866B635FBB086a789b3",
        Registry: "0x94160b094d53357180Fe952F2083C8247200c978",
        RoyaltySplitterImpl: "0x9Acd700c94d91D9155d1EE3b6cd21f31D0b6D244",
    },
    // Unichain Sepolia
    [unichainSepolia.id]: {
        EventFactory: "0x64fFDeE582187975b84E7Bba189D380D2289Dd6E",
        TicketMarketplace: "0x403D7d92024Cb6Be2Ff71866B635FBB086a789b3",
        Registry: "0x94160b094d53357180Fe952F2083C8247200c978",
        RoyaltySplitterImpl: "0x9Acd700c94d91D9155d1EE3b6cd21f31D0b6D244",
    },
};

// ─── Supported chains list (order = display order in wallet switcher) ───────

export const SUPPORTED_CHAINS = [
    etherlinkShadownetTestnet,
    sepolia,
    avalancheFuji,
    polygonAmoy,
    baseSepolia,
    optimismSepolia,
    unichainSepolia,
    // Uncomment as you deploy contracts:
    // etherlinkTestnet,
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
