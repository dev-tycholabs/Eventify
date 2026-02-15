"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { cookieStorage, createStorage } from "wagmi";
import { SUPPORTED_CHAINS } from "./chains";
import type { Chain } from "viem";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
    throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable");
}

export const config = getDefaultConfig({
    appName: "Decentralized Event Ticketing",
    projectId,
    chains: SUPPORTED_CHAINS as unknown as readonly [Chain, ...Chain[]],
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
});
