"use client";

import { formatEther } from "viem";
import { useTicketHistory, type TicketHistoryEntry } from "@/hooks/useTicketHistory";
import { useChainConfig } from "@/hooks/useChainConfig";
import type { TransactionType } from "@/lib/supabase/types";

interface TicketHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokenId: string;
    eventContractAddress: string;
    eventName: string;
}

export function TicketHistoryModal({
    isOpen,
    onClose,
    tokenId,
    eventContractAddress,
    eventName,
}: TicketHistoryModalProps) {
    const { history, isLoading, error } = useTicketHistory({
        tokenId,
        eventContractAddress,
        enabled: isOpen,
    });
    const { explorerUrl: EXPLORER_URL, currencySymbol } = useChainConfig();

    const getTypeConfig = (type: TransactionType) => {
        switch (type) {
            case "purchase":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    ),
                    bgColor: "bg-green-500/20",
                    iconColor: "text-green-400",
                    borderColor: "border-green-500/30",
                    label: "Purchased",
                };
            case "sale":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ),
                    bgColor: "bg-purple-500/20",
                    iconColor: "text-purple-400",
                    borderColor: "border-purple-500/30",
                    label: "Sold",
                };
            case "listing":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                    ),
                    bgColor: "bg-orange-500/20",
                    iconColor: "text-orange-400",
                    borderColor: "border-orange-500/30",
                    label: "Listed for Sale",
                };
            case "transfer":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                    ),
                    bgColor: "bg-blue-500/20",
                    iconColor: "text-blue-400",
                    borderColor: "border-blue-500/30",
                    label: "Transferred",
                };
            case "cancel":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ),
                    bgColor: "bg-red-500/20",
                    iconColor: "text-red-400",
                    borderColor: "border-red-500/30",
                    label: "Listing Cancelled",
                };
            default:
                return {
                    icon: null,
                    bgColor: "bg-gray-500/20",
                    iconColor: "text-gray-400",
                    borderColor: "border-gray-500/30",
                    label: type,
                };
        }
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const getDescription = (entry: TicketHistoryEntry) => {
        switch (entry.txType) {
            case "purchase":
                return `Bought by ${formatAddress(entry.userAddress)}`;
            case "sale":
                return `Sold by ${formatAddress(entry.fromAddress || entry.userAddress)} to ${formatAddress(entry.toAddress || "unknown")}`;
            case "listing":
                return `Listed by ${formatAddress(entry.userAddress)}`;
            case "transfer":
                return `Transferred from ${formatAddress(entry.fromAddress || "unknown")} to ${formatAddress(entry.toAddress || "unknown")}`;
            case "cancel":
                return `Listing cancelled by ${formatAddress(entry.userAddress)}`;
            default:
                return `Action by ${formatAddress(entry.userAddress)}`;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Ticket History</h2>
                            <p className="text-gray-400 text-sm">
                                {eventName} • Ticket #{tokenId}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex gap-4 animate-pulse">
                                    <div className="w-8 h-8 rounded-full bg-slate-700/50" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-700/50 rounded w-1/3" />
                                        <div className="h-3 bg-slate-700/50 rounded w-2/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400">{error}</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400">No history found for this ticket</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />

                            {/* Timeline entries */}
                            <div className="space-y-6">
                                {history.map((entry, index) => {
                                    const config = getTypeConfig(entry.txType);
                                    const isFirst = index === 0;

                                    return (
                                        <div key={entry.id} className="relative flex gap-4 pl-1">
                                            {/* Timeline dot */}
                                            <div className={`relative z-10 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center border-2 ${config.borderColor} ${isFirst ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-purple-500/50" : ""}`}>
                                                <span className={config.iconColor}>{config.icon}</span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 pb-2">
                                                <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <span className={`text-sm font-semibold ${config.iconColor}`}>
                                                            {config.label}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {entry.txTimestamp.toLocaleDateString("en-US", {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                            })}
                                                        </span>
                                                    </div>

                                                    <p className="text-gray-300 text-sm mb-2">
                                                        {getDescription(entry)}
                                                    </p>

                                                    {entry.amount && (
                                                        <p className="text-gray-400 text-sm">
                                                            Price: <span className="text-white font-medium">{formatEther(entry.amount)} {currencySymbol}</span>
                                                        </p>
                                                    )}

                                                    {entry.txHash && !entry.txHash.startsWith("list-") && !entry.txHash.startsWith("buy-") && !entry.txHash.startsWith("cancel-") && (
                                                        <a
                                                            href={`${EXPLORER_URL}/tx/${entry.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-2 transition-colors"
                                                        >
                                                            View transaction
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="w-full py-3 px-4 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
