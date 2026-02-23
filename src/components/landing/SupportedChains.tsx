"use client";

import {
    NetworkEtherlink,
    NetworkSepolia,
    NetworkAvalancheFuji,
    NetworkPolygonAmoy,
    NetworkBaseSepolia,
    NetworkOptimismSepolia,
    NetworkUnichain,
} from "@web3icons/react";

const chains = [
    { name: "Etherlink", Icon: NetworkEtherlink },
    { name: "Sepolia", Icon: NetworkSepolia },
    { name: "Avalanche Fuji", Icon: NetworkAvalancheFuji },
    { name: "Polygon Amoy", Icon: NetworkPolygonAmoy },
    { name: "Base Sepolia", Icon: NetworkBaseSepolia },
    { name: "OP Sepolia", Icon: NetworkOptimismSepolia },
    { name: "Unichain", Icon: NetworkUnichain },
];

export function SupportedChains() {
    return (
        <div className="mt-10">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">
                Live on {chains.length} testnets
            </p>
            <div className="flex items-center justify-center gap-5 flex-wrap">
                {chains.map((chain) => (
                    <div
                        key={chain.name}
                        className="group"
                        title={chain.name}
                    >
                        <div className="opacity-60 group-hover:opacity-100 transition-opacity duration-300 group-hover:scale-110 transform">
                            <chain.Icon size={32} variant="branded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
