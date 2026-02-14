"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { cookieStorage, createStorage } from "wagmi";
import { etherlink } from "./wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
    throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable");
}

export const config = getDefaultConfig({
    appName: "Decentralized Event Ticketing",
    projectId,
    chains: [etherlink],
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
});
