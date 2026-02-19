"use client";

import { useState, useRef, useEffect } from "react";
import { SUPPORTED_CHAINS } from "@/config/chains";

interface ChainFilterProps {
    value: number | null;
    onChange: (chainId: number | null) => void;
}

export function ChainFilter({ value, onChange }: ChainFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedChain = value ? SUPPORTED_CHAINS.find((c) => c.id === value) : null;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${value
                        ? "bg-purple-600 text-white"
                        : "bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50"
                    }`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {selectedChain ? selectedChain.name : "All Chains"}
                {value && (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onChange(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange(null); } }}
                        className="ml-1 p-0.5 hover:bg-purple-500 rounded-full transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 right-0 min-w-[200px] bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => { onChange(null); setIsOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer flex items-center justify-between ${!value ? "bg-purple-500/20 text-purple-300" : "text-white hover:bg-slate-700"
                            }`}
                    >
                        <span>All Chains</span>
                        {!value && (
                            <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>
                    {SUPPORTED_CHAINS.map((chain) => (
                        <button
                            key={chain.id}
                            type="button"
                            onClick={() => { onChange(chain.id); setIsOpen(false); }}
                            className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer flex items-center justify-between ${value === chain.id ? "bg-purple-500/20 text-purple-300" : "text-white hover:bg-slate-700"
                                }`}
                        >
                            <span>{chain.name}</span>
                            {value === chain.id && (
                                <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
