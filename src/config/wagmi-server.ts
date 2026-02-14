import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { etherlink } from "./wagmi";

// Server-compatible config for cookie parsing
// This config is used only for cookieToInitialState in server components
export const serverConfig = createConfig({
    chains: [etherlink],
    transports: {
        [etherlink.id]: http(),
    },
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
});
