"use client";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { config } from "@/config/wagmi-client";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

interface Web3ProviderProps {
    children: React.ReactNode;
    initialState?: State;
}

export function Web3Provider({ children, initialState }: Web3ProviderProps) {
    return (
        <WagmiProvider config={config} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>{children}</RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
