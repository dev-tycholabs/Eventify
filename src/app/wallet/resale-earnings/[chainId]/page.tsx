"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import Link from "next/link";
import {
    SUPPORTED_CHAINS,
    getNativeCurrencySymbol,
    getExplorerUrl,
} from "@/config/chains";

type ListingStatus = "active" | "sold" | "cancelled";

interface EventInfo {
    id: string;
    name: string;
    date: string | null;
    venue: string | null;
    image_url: string | null;
    ticket_price: string | null;
}

interface DBListing {
    id: string;
    listing_id: string;
    token_id: string;
    event_contract_address: string;
    event_id: string | null;
    chain_id: number;
    seller_address: string;
    price: string;
    status: ListingStatus;
    buyer_address: string | null;
    listed_at: string;
    sold_at: string | null;
    cancelled_at: string | null;
    tx_hash: string | null;
    events: EventInfo | null;
}

const STATUS_CONFIG: Record<ListingStatus, { label: string; color: string; bg: string }> = {
    active: { label: "Active", color: "text-blue-400", bg: "bg-blue-400/10" },
    sold: { label: "Sold", color: "text-green-400", bg: "bg-green-400/10" },
    cancelled: { label: "Cancelled", color: "text-red-400", bg: "bg-red-400/10" },
};

export default function ResaleEarningsChainPage() {
    const params = useParams();
    const chainId = Number(params.chainId);
    const { address, isConnected } = useAccount();

    const [listings, setListings] = useState<DBListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

    const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
    const chainName = chain?.name ?? `Chain ${chainId}`;
    const currencySymbol = getNativeCurrencySymbol(chainId);
    const explorerUrl = getExplorerUrl(chainId);

    const fetchListings = useCallback(async () => {
        if (!address) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                seller: address,
                chain_id: String(chainId),
                status: statusFilter === "all" ? "all" : statusFilter,
                limit: "200",
            });
            const res = await fetch(`/api/marketplace?${params}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setListings(data.listings ?? []);
            if (data.statusCounts) {
                setStatusCounts(data.statusCounts);
            }
        } catch {
            setListings([]);
        } finally {
            setLoading(false);
        }
    }, [address, chainId, statusFilter]);

    useEffect(() => {
        fetchListings();
    }, [fetchListings]);

    if (!isConnected) {
        return (
            <main className="min-h-screen bg-slate-900 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <p className="text-gray-400 text-lg">Connect your wallet to view resale earnings.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-900 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        href="/wallet"
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Wallet
                    </Link>
                    <h1 className="text-3xl font-bold text-white">Resale Listings</h1>
                    <p className="text-gray-400 mt-1">
                        Your resale activity on {chainName}
                    </p>
                </div>

                {/* Status filter tabs */}
                <div className="flex gap-2 mb-8 border-b border-white/10">
                    {(["all", "active", "sold", "cancelled"] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${statusFilter === s
                                ? "text-white"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {s === "all" ? "All" : STATUS_CONFIG[s].label}
                            {statusCounts[s] != null ? ` (${statusCounts[s]})` : ""}
                            {statusFilter === s && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Listings */}
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-slate-800/50 rounded-xl border border-white/10 p-5 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-slate-700/50 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 bg-slate-700/50 rounded w-1/3" />
                                        <div className="h-4 bg-slate-700/50 rounded w-1/2" />
                                    </div>
                                    <div className="h-6 bg-slate-700/50 rounded w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : listings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No Resale Listings</h3>
                        <p className="text-gray-400 max-w-sm">
                            You haven&apos;t listed any tickets for resale on {chainName} yet.
                        </p>
                        <Link
                            href="/marketplace"
                            className="mt-4 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            Go to Marketplace
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {listings.map((listing) => {
                            const status = STATUS_CONFIG[listing.status];
                            const eventName = listing.events?.name ?? "Unknown Event";
                            const eventDate = listing.events?.date
                                ? new Date(listing.events.date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })
                                : null;
                            const venue = listing.events?.venue;
                            const listedDate = new Date(listing.listed_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            });
                            const priceFormatted = formatEther(BigInt(listing.price));

                            return (
                                <div
                                    key={listing.id}
                                    className="bg-slate-800/50 rounded-xl border border-white/10 hover:border-white/20 transition-all p-5"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Event image */}
                                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-700/50 flex-shrink-0">
                                            {listing.events?.image_url ? (
                                                <img
                                                    src={listing.events.image_url}
                                                    alt={eventName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-white font-semibold truncate">{eventName}</h4>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color} ${status.bg}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                                                <span>Token #{listing.token_id}</span>
                                                {eventDate && (
                                                    <>
                                                        <span>·</span>
                                                        <span>{eventDate}</span>
                                                    </>
                                                )}
                                                {venue && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="truncate max-w-[150px]">{venue}</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                                                <span>Listed {listedDate}</span>
                                                {listing.status === "sold" && listing.sold_at && (
                                                    <>
                                                        <span>·</span>
                                                        <span>
                                                            Sold {new Date(listing.sold_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                        </span>
                                                    </>
                                                )}
                                                {listing.status === "sold" && listing.buyer_address && (
                                                    <>
                                                        <span>·</span>
                                                        <span>
                                                            Buyer: {listing.buyer_address.slice(0, 6)}...{listing.buyer_address.slice(-4)}
                                                        </span>
                                                    </>
                                                )}
                                                {listing.tx_hash && explorerUrl && (
                                                    <>
                                                        <span>·</span>
                                                        <a
                                                            href={`${explorerUrl}/tx/${listing.tx_hash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-purple-400 hover:text-purple-300"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            View tx ↗
                                                        </a>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-white font-bold text-lg">
                                                {priceFormatted} {currencySymbol}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
