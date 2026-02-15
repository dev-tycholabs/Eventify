import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { SUPPORTED_CHAINS } from "./chains";
import type { Chain } from "viem";

// Build transports map for all supported chains
const transports = Object.fromEntries(
    SUPPORTED_CHAINS.map((chain) => [chain.id, http()])
) as Record<number, ReturnType<typeof http>>;

// Server-compatible config for cookie parsing
// This config is used only for cookieToInitialState in server components
export const serverConfig = createConfig({
    chains: SUPPORTED_CHAINS as unknown as readonly [Chain, ...Chain[]],
    transports,
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
});
