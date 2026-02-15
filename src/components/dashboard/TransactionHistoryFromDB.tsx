"use client";

import { formatEther } from "viem";
import { useTransactionsFromDB, type TransactionFromDB } from "@/hooks/useTransactionsFromDB";
import { useChainConfig } from "@/hooks/useChainConfig";
import type { TransactionType } from "@/lib/supabase/types";

interface TransactionHistoryFromDBProps {
    address: `0x${string}`;
}

export function TransactionHistoryFromDB({ address }: TransactionHistoryFromDBProps) {
    const { transactions, isLoading } = useTransactionsFromDB({ user: address });
    const { explorerUrl: EXPLORER_URL, currencySymbol } = useChainConfig();

    const getTypeIcon = (type: TransactionType) => {
        switch (type) {
            case "purchase":
                return (
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                );
            case "sale":
                return (
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
            case "listing":
                return (
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                    </div>
                );
            case "transfer":
                return (
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                    </div>
                );
            case "cancel":
                return (
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                );
        }
    };

    const getTypeLabel = (type: TransactionType) => {
        switch (type) {
            case "purchase":
                return "Purchased";
            case "sale":
                return "Sold";
            case "listing":
                return "Listed";
            case "transfer":
                return "Transferred";
            case "cancel":
                return "Cancelled";
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className="bg-slate-800/50 rounded-xl p-4 border border-white/10 animate-pulse"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-700/50" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-700/50 rounded w-1/3" />
                                <div className="h-3 bg-slate-700/50 rounded w-1/4" />
                            </div>
                            <div className="h-4 bg-slate-700/50 rounded w-24" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
                    <svg
                        className="w-10 h-10 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Transactions Yet</h3>
                <p className="text-gray-400 max-w-md">
                    Your transaction history will appear here once you purchase, sell, or transfer tickets.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {transactions.map((tx) => (
                <div
                    key={tx.id}
                    className="bg-slate-800/50 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        {getTypeIcon(tx.txType)}

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-medium">
                                    {getTypeLabel(tx.txType)}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-400 text-sm truncate">
                                    {tx.eventName || "Event Ticket"}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                {tx.tokenId && (
                                    <>
                                        <span className="text-gray-500">
                                            Ticket #{tx.tokenId}
                                        </span>
                                        <span className="text-gray-600">•</span>
                                    </>
                                )}
                                <span className="text-gray-500">
                                    {tx.txTimestamp.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {tx.amount && tx.txType !== "listing" && tx.txType !== "cancel" && (
                                <span className={`font-semibold ${tx.txType === "purchase" ? "text-red-400" : "text-green-400"
                                    }`}>
                                    {tx.txType === "purchase" ? "-" : "+"}{formatEther(tx.amount)} {currencySymbol}
                                </span>
                            )}

                            {tx.txHash && !tx.txHash.startsWith("list-") && !tx.txHash.startsWith("buy-") && !tx.txHash.startsWith("cancel-") && (
                                <a
                                    href={`${EXPLORER_URL}/tx/${tx.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-gray-400 hover:text-white transition-colors"
                                    title="View on Explorer"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
