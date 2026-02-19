"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { TicketGalleryFromDB } from "@/components/dashboard/TicketGalleryFromDB";
import { TransactionHistoryFromDB } from "@/components/dashboard/TransactionHistoryFromDB";
import { ChainFilter } from "@/components/ui/ChainFilter";
import { StyledSelect } from "@/components/ui/StyledSelect";

type TabType = "tickets" | "history";
type TicketFilter = "all" | "unlisted" | "listed";

const TICKET_FILTER_OPTIONS = [
    { value: "all", label: "All" },
    { value: "unlisted", label: "Unlisted" },
    { value: "listed", label: "Listed" },
];

export default function DashboardPage() {
    const { isConnected, address } = useAccount();
    const [activeTab, setActiveTab] = useState<TabType>("tickets");
    const [ticketFilter, setTicketFilter] = useState<TicketFilter>("all");
    const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

    // Protected route - require wallet connection
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mb-6">
                            <svg
                                className="w-10 h-10 text-purple-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-3">
                            Connect Your Wallet
                        </h1>
                        <p className="text-gray-400 max-w-md mb-6">
                            Please connect your wallet to view your tickets and transaction history.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">My Dashboard</h1>
                    <p className="text-gray-400">
                        Manage your tickets and view transaction history
                    </p>
                </div>

                {/* Tab Navigation with Filter */}
                <div className="flex items-center justify-between mb-8 border-b border-white/10">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab("tickets")}
                            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "tickets"
                                ? "text-white"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            My Tickets
                            {activeTab === "tickets" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "history"
                                ? "text-white"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Transaction History
                            {activeTab === "history" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                        </button>
                    </div>

                    {/* Filter Dropdown - Only show on tickets tab */}
                    {activeTab === "tickets" && (
                        <div className="flex items-center gap-3 pb-3">
                            <ChainFilter value={selectedChainId} onChange={setSelectedChainId} />
                            <StyledSelect
                                value={ticketFilter}
                                onChange={(val) => setTicketFilter(val as TicketFilter)}
                                options={TICKET_FILTER_OPTIONS}
                            />
                        </div>
                    )}
                    {activeTab === "history" && (
                        <div className="pb-3">
                            <ChainFilter value={selectedChainId} onChange={setSelectedChainId} />
                        </div>
                    )}
                </div>

                {/* Tab Content */}
                {activeTab === "tickets" ? (
                    <TicketGalleryFromDB address={address!} filter={ticketFilter} chainId={selectedChainId} />
                ) : (
                    <TransactionHistoryFromDB address={address!} chainId={selectedChainId} />
                )}
            </div>
        </div>
    );
}
