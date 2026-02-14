import { defineChain } from "viem";

export const etherlink = defineChain({
    id: 127823,
    name: "Etherlink Shadownet",
    nativeCurrency: {
        decimals: 18,
        name: "XTZ",
        symbol: "XTZ",
    },
    rpcUrls: {
        // default: { http: ["https://node.shadownet.etherlink.com"] },
        default: { http: ["https://rpc.ankr.com/etherlink_shadownet_testnet/2135afba8b48f4f1701817fbf369fd1388798385298a736c0009a1dccd638770"] },
    },
    blockExplorers: {
        default: {
            name: "Explorer",
            url: "https://shadownet.explorer.etherlink.com",
        },
    },
    testnet: true,
});
