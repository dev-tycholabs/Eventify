"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useChainConfig } from "@/hooks/useChainConfig";
import { useMultiChainBalances, type ChainBalance } from "@/hooks/useMultiChainBalances";
import { SUPPORTED_CHAINS, getNativeCurrencySymbol } from "@/config/chains";
import { ChainFilter } from "@/components/ui/ChainFilter";
import Link from "next/link";

type WalletTab = "earnings" | "royalties";

interface RoyaltyEvent {
    id: string;
    percentage: number;
    royalty_earned: string;
    royalty_claimed: string;
    recipient_name: string | null;
    event_id: string;
    events: {
        id: string;
        name: string;
        date: string | null;
        image_url: string | null;
        venue: string | null;
        city: string | null;
        contract_address: string | null;
        chain_id: number;
        royalty_percent: string | null;
        royalty_splitter_address: string | null;
        organizer_address: string;
        status: string;
    } | null;
}

export function WalletDashboard() {
    const { address, isConnected } = useAccount();
    const { chainId: connectedChainId } = useChainConfig();
    const { claimFunds, isLoading: isClaimLoading } = useMarketplace();
    const { switchChainAsync } = useSwitchChain();
    const { balances, loading: loadingBalances, refresh: refreshBalances } = useMultiChainBalances();

    const [activeTab, setActiveTab] = useState<WalletTab>("earnings");
    const [royaltyEvents, setRoyaltyEvents] = useState<RoyaltyEvent[]>([]);
    const [loadingRoyalties, setLoadingRoyalties] = useState(false);
    const [claimingChainId, setClaimingChainId] = useState<number | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

    const filteredBalances = selectedChainId
        ? balances.filter((b) => b.chainId === selectedChainId)
        : balances;

    const filteredRoyaltyEvents = selectedChainId
        ? royaltyEvents.filter((r) => r.events?.chain_id === selectedChainId)
        : royaltyEvents;

    const loadRoyaltyEvents = useCallback(async () => {
        if (!address) return;
        setLoadingRoyalties(true);
        try {
            const res = await fetch(`/api/wallet/royalties?address=${address}`);
            const data = await res.json();
            setRoyaltyEvents(data.royalties || []);
        } catch (err) {
            console.error("Failed to load royalty events:", err);
        } finally {
            setLoadingRoyalties(false);
        }
    }, [address]);

    useEffect(() => {
        if (isConnected && address) {
            loadRoyaltyEvents();
        }
    }, [isConnected, address, loadRoyaltyEvents]);

    const handleClaimOnChain = async (targetChainId: number) => {
        setClaimingChainId(targetChainId);
        try {
            // Switch chain if needed
            if (targetChainId !== connectedChainId) {
                await switchChainAsync({ chainId: targetChainId });
                // After switching, wagmi will re-render and the user can click again
                // since claimFunds uses the current chain's contracts
                return;
            }
            const result = await claimFunds();
            if (result.success) {
                await refreshBalances();
            }
        } catch (err) {
            console.error("Claim failed:", err);
        } finally {
            setClaimingChainId(null);
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
                    <p className="text-gray-400">Please connect your wallet to view your resale earnings</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Wallet</h1>
                <p className="text-gray-400 mt-1">Manage your resale earnings and royalties</p>
            </div>

            {/* Tabs */}
            <div className="flex items-center mb-6 border-b border-white/10">
                <button
                    onClick={() => setActiveTab("earnings")}
                    className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "earnings" ? "text-white" : "text-gray-400 hover:text-white"
                        }`}
                >
                    Resale Earnings
                    {activeTab === "earnings" && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("royalties")}
                    className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "royalties" ? "text-white" : "text-gray-400 hover:text-white"
                        }`}
                >
                    Royalties ({filteredRoyaltyEvents.length})
                    {activeTab === "royalties" && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                    )}
                </button>

                <div className="ml-auto flex items-center gap-3 pb-1">
                    <ChainFilter value={selectedChainId} onChange={setSelectedChainId} />
                    {activeTab === "earnings" && (
                        <button
                            onClick={refreshBalances}
                            disabled={loadingBalances}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                        >
                            <svg className={`w-4 h-4 ${loadingBalances ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh All
                        </button>
                    )}
                </div>
            </div>

            {/* Earnings Tab */}
            {activeTab === "earnings" && (
                <div className="space-y-4">
                    {loadingBalances && balances.length === 0 ? (
                        <div className="space-y-4">
                            {[...Array(SUPPORTED_CHAINS.length)].map((_, i) => (
                                <div key={i} className="p-6 bg-slate-800/50 rounded-xl border border-white/10 animate-pulse">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-2">
                                            <div className="h-5 bg-slate-700/50 rounded w-40" />
                                            <div className="h-4 bg-slate-700/50 rounded w-56" />
                                        </div>
                                        <div className="h-8 bg-slate-700/50 rounded w-28" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {filteredBalances.map((chain) => (
                                <ChainEarningsCard
                                    key={chain.chainId}
                                    chain={chain}
                                    isConnectedChain={chain.chainId === connectedChainId}
                                    isClaiming={claimingChainId === chain.chainId}
                                    isClaimLoading={isClaimLoading}
                                    onClaim={() => handleClaimOnChain(chain.chainId)}
                                />
                            ))}

                            {filteredBalances.length > 0 && filteredBalances.every((b) => b.balance === BigInt(0) && !b.loading) && (
                                <p className="text-gray-500 text-sm text-center py-4">
                                    No funds to claim on any chain. Sell tickets on the marketplace to earn!
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Royalties Tab */}
            {activeTab === "royalties" && (
                <div>
                    {loadingRoyalties ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="bg-slate-800/50 rounded-xl border border-white/10 p-5 animate-pulse">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-700/50 rounded-lg" />
                                        <div className="flex-1">
                                            <div className="h-5 bg-slate-700/50 rounded w-1/3 mb-2" />
                                            <div className="h-4 bg-slate-700/50 rounded w-1/2" />
                                        </div>
                                        <div className="h-6 bg-slate-700/50 rounded w-20" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredRoyaltyEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">No Royalties Yet</h3>
                            <p className="text-gray-400 max-w-sm">
                                {selectedChainId
                                    ? "No royalties found on this chain."
                                    : "You are not listed as a royalty recipient for any events yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredRoyaltyEvents.map((item) => (
                                <RoyaltyEventCard
                                    key={item.id}
                                    item={item}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ChainEarningsCard({
    chain,
    isConnectedChain,
    isClaiming,
    isClaimLoading,
    onClaim,
}: {
    chain: ChainBalance;
    isConnectedChain: boolean;
    isClaiming: boolean;
    isClaimLoading: boolean;
    onClaim: () => void;
}) {
    const hasBalance = chain.balance > BigInt(0);
    const busy = isClaiming || (isClaimLoading && isConnectedChain);

    return (
        <div
            className={`p-5 rounded-xl border transition-all ${hasBalance
                ? "bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-500/20"
                : "bg-slate-800/50 border-white/10"
                }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Chain indicator dot */}
                    <div
                        className={`w-3 h-3 rounded-full ${isConnectedChain ? "bg-green-400" : "bg-gray-500"
                            }`}
                        title={isConnectedChain ? "Connected" : "Not connected"}
                    />
                    <div>
                        <h4 className="text-white font-semibold flex items-center gap-2">
                            {chain.chainName}
                            {isConnectedChain && (
                                <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                                    Connected
                                </span>
                            )}
                        </h4>
                        <p className="text-gray-400 text-sm">Resale earnings</p>
                    </div>
                </div>
                <div className="text-right">
                    {chain.loading ? (
                        <div className="animate-pulse bg-white/10 h-7 w-24 rounded" />
                    ) : chain.error ? (
                        <p className="text-red-400 text-sm">Failed to load</p>
                    ) : (
                        <p className={`text-xl font-bold ${hasBalance ? "text-green-400" : "text-gray-500"}`}>
                            {chain.formatted} {chain.currencySymbol}
                        </p>
                    )}
                </div>
            </div>

            {hasBalance && !chain.loading && (
                <div className="mt-3">
                    <button
                        onClick={onClaim}
                        disabled={busy}
                        className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                        {busy ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                {!isConnectedChain ? "Switching chain..." : "Claiming..."}
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {isConnectedChain ? "Claim Funds" : `Switch to ${chain.chainName} & Claim`}
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

function RoyaltyEventCard({ item }: { item: RoyaltyEvent }) {
    const event = item.events;
    if (!event) return null;

    const currencySymbol = getNativeCurrencySymbol(event.chain_id);
    const earned = parseFloat(item.royalty_earned || "0") / 1e18;
    const claimed = parseFloat(item.royalty_claimed || "0") / 1e18;
    const pending = earned - claimed;
    const eventDate = event.date ? new Date(event.date) : null;

    return (
        <Link
            href={`/events/${event.id}`}
            className="block bg-slate-800/50 rounded-xl border border-white/10 hover:border-purple-500/30 transition-all duration-300 p-5"
        >
            <div className="flex items-center gap-4">
                {/* Event Image */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-700/50 flex-shrink-0">
                    {event.image_url ? (
                        <img
                            src={event.image_url}
                            alt={event.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Event Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold truncate">{event.name}</h4>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        {eventDate && (
                            <span>{eventDate.toLocaleDateString()}</span>
                        )}
                        {event.city && (
                            <>
                                <span>·</span>
                                <span>{event.city}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="text-purple-400">
                            {item.percentage}% share
                        </span>
                        {event.royalty_percent && (
                            <>
                                <span className="text-gray-600">·</span>
                                <span className="text-gray-400">
                                    {event.royalty_percent}% royalty
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Earnings */}
                <div className="text-right flex-shrink-0">
                    <p className="text-green-400 font-semibold">
                        {earned.toFixed(4)} {currencySymbol}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">earned</p>
                    {pending > 0 && (
                        <p className="text-xs text-yellow-400 mt-1">
                            {pending.toFixed(4)} pending
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
}
