"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { getPublicClient } from "wagmi/actions";
import { config } from "@/config/wagmi-client";
import { Header } from "@/components/Header";
import { EventTicketABI } from "@/hooks/contracts";
import { txToast } from "@/utils/toast";
import { EventTicketScanner } from "@/components/events/EventTicketScanner";
import { RoyaltySplitterPanel } from "@/components/events/RoyaltySplitterPanel";
import { EventAttendeesPanel } from "@/components/events/EventAttendeesPanel";
import { useChainConfig } from "@/hooks/useChainConfig";
import { getExplorerUrl } from "@/config/chains";

interface RoyaltyRecipientData {
    id: string;
    recipient_address: string;
    recipient_name: string | null;
    percentage: number;
    royalty_earned: string;
    royalty_claimed: string;
}

interface ResaleListing {
    id: string;
    listing_id: string;
    token_id: string;
    seller_address: string;
    buyer_address: string | null;
    price: string;
    status: "active" | "sold" | "cancelled";
    listed_at: string;
    sold_at: string | null;
    cancelled_at: string | null;
}

interface ResaleStats {
    totalListings: number;
    activeListings: number;
    soldListings: number;
    cancelledListings: number;
    totalResaleVolume: bigint;
    avgResalePrice: bigint;
    highestResalePrice: bigint;
    listings: ResaleListing[];
}

interface EventData {
    id: string;
    name: string;
    venue: string;
    date: Date;
    ticketPrice: bigint;
    maxSupply: number;
    soldCount: number;
    organizer: string;
    contractAddress: `0x${string}`;
    contractBalance: bigint;
    chainId: number;
    description: string | null;
    imageUrl: string | null;
    royaltySplitterAddress: string | null;
    royaltyRecipients: RoyaltyRecipientData[];
    resaleStats: ResaleStats;
}

export default function EventManagePage() {
    const params = useParams();
    const eventId = params.id as string;

    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { writeContractAsync } = useWriteContract();
    const { currencySymbol } = useChainConfig();

    const [eventData, setEventData] = useState<EventData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "attendees" | "scanner" | "royalties" | "settings">("overview");
    const [newBaseURI, setNewBaseURI] = useState("");
    const [currentBaseURI, setCurrentBaseURI] = useState<string>("");
    const [isUpdatingURI, setIsUpdatingURI] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch event details from API by ID
    const fetchEventData = useCallback(async () => {
        if (!eventId) return;

        setIsLoading(true);
        setError(null);

        try {
            // Fetch event from API
            const response = await fetch(`/api/events/${eventId}`);

            if (!response.ok) {
                if (response.status === 404) {
                    setError("Event not found");
                } else {
                    setError("Failed to fetch event");
                }
                setEventData(null);
                return;
            }

            const { event, royaltyRecipients: dbRoyaltyRecipients, resaleListings } = await response.json();

            if (!event || !event.contract_address) {
                setError("Event not found or not published");
                setEventData(null);
                return;
            }

            const contractAddress = event.contract_address as `0x${string}`;
            const eventChainId = event.chain_id as number;

            // Fetch contract balance using chain-specific client
            let balance = BigInt(0);
            try {
                const chainPublicClient = getPublicClient(config, { chainId: eventChainId });
                if (chainPublicClient) {
                    balance = await chainPublicClient.getBalance({ address: contractAddress });
                }
            } catch (err) {
                console.error("Failed to fetch balance:", err);
            }

            // Compute resale stats
            const listings: ResaleListing[] = resaleListings || [];
            const soldListings = listings.filter((l: ResaleListing) => l.status === "sold");
            const soldPrices = soldListings.map((l: ResaleListing) => BigInt(l.price || "0"));
            const totalResaleVolume = soldPrices.reduce((sum: bigint, p: bigint) => sum + p, BigInt(0));
            const highestResalePrice = soldPrices.length > 0 ? soldPrices.reduce((max: bigint, p: bigint) => p > max ? p : max, BigInt(0)) : BigInt(0);
            const avgResalePrice = soldPrices.length > 0 ? totalResaleVolume / BigInt(soldPrices.length) : BigInt(0);

            const resaleStats: ResaleStats = {
                totalListings: listings.length,
                activeListings: listings.filter((l: ResaleListing) => l.status === "active").length,
                soldListings: soldListings.length,
                cancelledListings: listings.filter((l: ResaleListing) => l.status === "cancelled").length,
                totalResaleVolume,
                avgResalePrice,
                highestResalePrice,
                listings,
            };

            setEventData({
                id: event.id,
                name: event.name,
                venue: event.venue || "",
                date: event.date ? new Date(event.date) : new Date(),
                ticketPrice: BigInt(Math.floor(parseFloat(event.ticket_price || "0") * 1e18)),
                maxSupply: event.total_supply || 0,
                soldCount: event.sold_count || 0,
                organizer: event.organizer_address,
                contractAddress,
                contractBalance: balance,
                chainId: eventChainId,
                description: event.description,
                imageUrl: event.image_url,
                royaltySplitterAddress: event.royalty_splitter_address || null,
                royaltyRecipients: dbRoyaltyRecipients || [],
                resaleStats,
            });
        } catch (err) {
            console.error("Failed to fetch event:", err);
            setError("Failed to fetch event details");
            setEventData(null);
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        if (eventId) {
            fetchEventData();
        }
    }, [eventId, fetchEventData]);

    // Check authorization when address or eventData changes
    useEffect(() => {
        if (address && eventData) {
            const isOrganizer = address.toLowerCase() === eventData.organizer?.toLowerCase();
            setIsAuthorized(isOrganizer);
        } else {
            setIsAuthorized(false);
        }
    }, [address, eventData]);

    // Fetch current base URI from contract
    const fetchBaseURI = useCallback(async () => {
        if (!eventData?.contractAddress || !eventData?.chainId) return;

        try {
            const chainPublicClient = getPublicClient(config, { chainId: eventData.chainId });
            if (!chainPublicClient) return;

            const baseURI = await chainPublicClient.readContract({
                address: eventData.contractAddress,
                abi: EventTicketABI,
                functionName: "baseTokenURI",
            });
            setCurrentBaseURI(baseURI as string);
        } catch (err) {
            console.error("Failed to fetch base URI:", err);
            setCurrentBaseURI("");
        }
    }, [eventData?.contractAddress, eventData?.chainId]);

    // Fetch base URI when event data is available
    useEffect(() => {
        if (eventData?.contractAddress) {
            fetchBaseURI();
        }
    }, [eventData?.contractAddress, fetchBaseURI]);


    const handleWithdraw = async () => {
        if (!walletClient || !eventData) return;

        try {
            txToast.pending("Withdrawing funds...");
            await writeContractAsync({
                address: eventData.contractAddress,
                abi: EventTicketABI,
                functionName: "withdrawFunds",
            });
            txToast.success("Funds withdrawn successfully!");
            await fetchEventData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes("NoFundsToWithdraw")) {
                txToast.error("No funds available to withdraw");
            } else if (errorMessage.includes("User rejected")) {
                txToast.error("Transaction was rejected");
            } else {
                txToast.error("Failed to withdraw funds");
            }
        }
    };

    const handleUpdateURI = async () => {
        if (!newBaseURI.trim() || !walletClient || !eventData) return;

        setIsUpdatingURI(true);
        try {
            txToast.pending("Updating metadata URI...");
            await writeContractAsync({
                address: eventData.contractAddress,
                abi: EventTicketABI,
                functionName: "setBaseURI",
                args: [newBaseURI],
            });
            txToast.success("Metadata URI updated!");
            setCurrentBaseURI(newBaseURI);
            setNewBaseURI("");
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes("User rejected")) {
                txToast.error("Transaction was rejected");
            } else {
                txToast.error("Failed to update URI");
            }
        } finally {
            setIsUpdatingURI(false);
        }
    };

    // Not connected state
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-950">
                <Header />
                <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                            <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h1>
                            <p className="text-gray-400 max-w-md">
                                Please connect your wallet to manage this event.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950">
                <Header />
                <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="animate-pulse space-y-6">
                            <div className="h-8 bg-slate-800/50 rounded w-1/3" />
                            <div className="h-4 bg-slate-800/50 rounded w-1/4" />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-32 bg-slate-800/50 rounded-xl" />
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Error or not found state
    if (error || !eventData) {
        return (
            <div className="min-h-screen bg-slate-950">
                <Header />
                <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-3">Event Not Found</h1>
                            <p className="text-gray-400 max-w-md mb-6">
                                {error || "This event could not be found."}
                            </p>
                            <Link
                                href="/events/my-events"
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all"
                            >
                                Back to My Events
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Unauthorized state
    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-slate-950">
                <Header />
                <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                            <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-3">Unauthorized Access</h1>
                            <p className="text-gray-400 max-w-md mb-6">
                                You are not the organizer of this event.
                            </p>
                            <Link
                                href="/events/my-events"
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all"
                            >
                                Back to My Events
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const isPast = eventData.date < new Date();
    const soldPercentage = (eventData.soldCount / eventData.maxSupply) * 100;
    const hasBalance = eventData.contractBalance > BigInt(0);
    const remainingTickets = eventData.maxSupply - eventData.soldCount;


    return (
        <div className="min-h-screen bg-slate-950">
            <Header />
            <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    {/* Back Button & Header */}
                    <div className="mb-8">
                        <Link
                            href="/events/my-events"
                            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to My Events
                        </Link>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl font-bold text-white">{eventData.name}</h1>
                                    <span
                                        className={`px-3 py-1 text-xs font-medium rounded-full ${isPast
                                            ? "bg-gray-500/20 text-gray-400"
                                            : "bg-green-500/20 text-green-400"
                                            }`}
                                    >
                                        {isPast ? "Past" : "Active"}
                                    </span>
                                </div>
                                <p className="text-gray-400">{eventData.venue}</p>
                            </div>
                            <button
                                onClick={handleWithdraw}
                                disabled={!hasBalance}
                                className={`px-6 py-3 font-semibold rounded-xl transition-all cursor-pointer ${hasBalance
                                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500"
                                    : "bg-slate-700/50 text-gray-500 cursor-not-allowed"
                                    }`}
                            >
                                Withdraw {formatEther(eventData.contractBalance)} {currencySymbol}
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/10 mb-6">
                        <button
                            onClick={() => setActiveTab("overview")}
                            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "overview" ? "text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Overview
                            {activeTab === "overview" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("attendees")}
                            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "attendees" ? "text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Attendees
                            {activeTab === "attendees" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("scanner")}
                            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "scanner" ? "text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Ticket Scanner
                            {activeTab === "scanner" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("royalties")}
                            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "royalties" ? "text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Royalties
                            {activeTab === "royalties" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("settings")}
                            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "settings" ? "text-white" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Settings
                            {activeTab === "settings" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                        </button>
                    </div>

                    {/* Overview Tab */}
                    {activeTab === "overview" && (
                        <div className="space-y-6">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Event Date</p>
                                    <p className="text-lg font-semibold text-white">
                                        {eventData.date.toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        {eventData.date.toLocaleTimeString("en-US", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Ticket Price</p>
                                    <p className="text-lg font-semibold text-white">
                                        {formatEther(eventData.ticketPrice)} {currencySymbol}
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tickets Sold</p>
                                    <p className="text-lg font-semibold text-white">
                                        {eventData.soldCount} / {eventData.maxSupply}
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Revenue</p>
                                    <p className="text-lg font-semibold text-green-400">
                                        {formatEther(eventData.ticketPrice * BigInt(eventData.soldCount))} {currencySymbol}
                                    </p>
                                </div>
                            </div>

                            {/* Sales Progress */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                                <h3 className="text-sm font-medium text-gray-400 mb-4">Sales Progress</h3>
                                <div className="flex items-end justify-between mb-3">
                                    <div>
                                        <p className="text-3xl font-bold text-white">{soldPercentage.toFixed(1)}%</p>
                                        <p className="text-sm text-gray-400">of tickets sold</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-semibold text-gray-400">{remainingTickets}</p>
                                        <p className="text-sm text-gray-500">remaining</p>
                                    </div>
                                </div>
                                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                                        style={{ width: `${soldPercentage}%` }}
                                    />
                                </div>
                            </div>

                            {/* Resale Activity */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                                <h3 className="text-sm font-medium text-gray-400 mb-4">Secondary Market Activity</h3>
                                {eventData.resaleStats.totalListings === 0 ? (
                                    <p className="text-sm text-gray-500">No resale activity yet for this event.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Resale Stats Grid */}
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Listed</p>
                                                <p className="text-lg font-semibold text-white">{eventData.resaleStats.totalListings}</p>
                                            </div>
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Active</p>
                                                <p className="text-lg font-semibold text-yellow-400">{eventData.resaleStats.activeListings}</p>
                                            </div>
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sold</p>
                                                <p className="text-lg font-semibold text-green-400">{eventData.resaleStats.soldListings}</p>
                                            </div>
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cancelled</p>
                                                <p className="text-lg font-semibold text-gray-400">{eventData.resaleStats.cancelledListings}</p>
                                            </div>
                                        </div>

                                        {/* Volume Stats */}
                                        {eventData.resaleStats.soldListings > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="bg-slate-900/50 rounded-lg p-3">
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resale Volume</p>
                                                    <p className="text-lg font-semibold text-green-400">{formatEther(eventData.resaleStats.totalResaleVolume)} {currencySymbol}</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-lg p-3">
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Resale Price</p>
                                                    <p className="text-lg font-semibold text-purple-400">{formatEther(eventData.resaleStats.avgResalePrice)} {currencySymbol}</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-lg p-3">
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Highest Sale</p>
                                                    <p className="text-lg font-semibold text-pink-400">{formatEther(eventData.resaleStats.highestResalePrice)} {currencySymbol}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Recent Resale Listings */}
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Recent Listings</p>
                                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                                {eventData.resaleStats.listings.slice(0, 10).map((listing) => (
                                                    <div key={listing.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <span className="text-sm text-white font-mono">#{listing.token_id}</span>
                                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${listing.status === "active"
                                                                ? "bg-yellow-500/20 text-yellow-400"
                                                                : listing.status === "sold"
                                                                    ? "bg-green-500/20 text-green-400"
                                                                    : "bg-gray-500/20 text-gray-400"
                                                                }`}>
                                                                {listing.status}
                                                            </span>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="text-sm font-medium text-white">{formatEther(BigInt(listing.price || "0"))} {currencySymbol}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {new Date(listing.listed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Contract Info */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                                <h3 className="text-sm font-medium text-gray-400 mb-4">Contract Information</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Contract Address</span>
                                        <a
                                            href={`${getExplorerUrl(eventData.chainId)}/address/${eventData.contractAddress}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-purple-400 hover:text-purple-300 font-mono flex items-center gap-1"
                                        >
                                            {eventData.contractAddress.slice(0, 10)}...{eventData.contractAddress.slice(-8)}
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Contract Balance</span>
                                        <span className={`text-sm font-medium ${hasBalance ? "text-green-400" : "text-gray-400"}`}>
                                            {formatEther(eventData.contractBalance)} {currencySymbol}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Attendees Tab */}
                    {activeTab === "attendees" && (
                        <EventAttendeesPanel eventId={eventData.id} />
                    )}

                    {/* Scanner Tab */}
                    {activeTab === "scanner" && (
                        <EventTicketScanner
                            eventContractAddress={eventData.contractAddress}
                            eventName={eventData.name}
                        />
                    )}

                    {/* Royalties Tab */}
                    {activeTab === "royalties" && (
                        <RoyaltySplitterPanel
                            eventId={eventData.id}
                            eventContractAddress={eventData.contractAddress}
                            organizerAddress={eventData.organizer}
                            splitterAddress={eventData.royaltySplitterAddress}
                            recipients={eventData.royaltyRecipients}
                            onDistributionSynced={fetchEventData}
                        />
                    )}

                    {/* Settings Tab */}
                    {activeTab === "settings" && (
                        <div className="space-y-6">
                            {/* Metadata URI */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                                <h3 className="text-sm font-medium text-white mb-2">Metadata Base URI</h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    Update the base URI for ticket metadata (e.g., IPFS gateway URL)
                                </p>

                                {/* Current Base URI Display */}
                                <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                    <p className="text-xs text-gray-500 mb-1">Current Base URI</p>
                                    <p className="text-sm text-gray-300 font-mono break-all">
                                        {currentBaseURI || <span className="text-gray-500 italic">Not set</span>}
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={newBaseURI}
                                        onChange={(e) => setNewBaseURI(e.target.value)}
                                        placeholder="ipfs://... or https://..."
                                        className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
                                    />
                                    <button
                                        onClick={handleUpdateURI}
                                        disabled={isUpdatingURI || !newBaseURI.trim()}
                                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                                    >
                                        {isUpdatingURI ? "Updating..." : "Update Metadata URI"}
                                    </button>
                                </div>
                            </div>

                            {/* Immutable Fields Info */}
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
                                <div className="flex gap-3">
                                    <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="text-sm font-medium text-amber-400 mb-1">Immutable Event Data</h4>
                                        <p className="text-xs text-amber-400/70">
                                            Event name, venue, date, ticket price, and supply cannot be changed after creation.
                                            This ensures ticket authenticity and prevents fraud.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
