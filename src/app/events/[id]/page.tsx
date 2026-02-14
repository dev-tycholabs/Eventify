"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEther, parseEther } from "viem";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { EventTicketABI } from "@/hooks/contracts";
import { syncTicket, syncTransaction } from "@/lib/api/sync";
import type { Tables } from "@/lib/supabase/types";
import { txToast } from "@/utils/toast";
import CommentSection from "@/components/events/CommentSection";
import ChatRoom from "@/components/events/ChatRoom";

type TransactionStatus = "idle" | "pending" | "success" | "error";
type DBEvent = Tables<"events">;
type RoyaltyRecipient = Tables<"royalty_recipients">;

export default function EventDetailsPage() {
    const params = useParams();
    const eventId = params.id as string;
    const { isConnected, address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    const [dbEvent, setDbEvent] = useState<DBEvent | null>(null);
    const [royaltyRecipients, setRoyaltyRecipients] = useState<RoyaltyRecipient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [txStatus, setTxStatus] = useState<TransactionStatus>("idle");
    const [txError, setTxError] = useState<string | null>(null);
    const [userTicketCount, setUserTicketCount] = useState(0);

    // Gallery carousel state
    const [carouselOpen, setCarouselOpen] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);

    // Hero image lightbox state
    const [heroLightboxOpen, setHeroLightboxOpen] = useState(false);
    const [heroLightboxImage, setHeroLightboxImage] = useState<string | null>(null);

    // Fetch event data from Supabase by ID
    useEffect(() => {
        async function fetchEventFromDB() {
            if (!eventId) return;
            setIsLoading(true);
            try {
                const response = await fetch(`/api/events/${eventId}`);
                if (response.ok) {
                    const data = await response.json();
                    setDbEvent(data.event);
                    setRoyaltyRecipients(data.royaltyRecipients || []);
                }
            } catch (err) {
                console.error("Failed to fetch event from DB:", err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchEventFromDB();
    }, [eventId]);

    // Fetch user's ticket count for this event
    useEffect(() => {
        async function fetchUserTicketCount() {
            if (!address || !dbEvent?.contract_address) return;
            try {
                const response = await fetch(`/api/tickets?owner=${address}&contract=${dbEvent.contract_address}`);
                if (response.ok) {
                    const data = await response.json();
                    setUserTicketCount(data.tickets?.length || 0);
                }
            } catch (err) {
                console.error("Failed to fetch user ticket count:", err);
            }
        }
        fetchUserTicketCount();
    }, [address, dbEvent?.contract_address]);

    // Derived values from DB
    const contractAddress = dbEvent?.contract_address as `0x${string}` | undefined;
    const ticketPrice = dbEvent?.ticket_price ? parseEther(dbEvent.ticket_price) : BigInt(0);
    const totalSupply = dbEvent?.total_supply || 0;
    const soldCount = dbEvent?.sold_count || 0;
    const remainingTickets = totalSupply - soldCount;
    const isSoldOut = remainingTickets <= 0;
    const maxPerWallet = dbEvent?.max_tickets_per_wallet || 5;
    const remainingForUser = maxPerWallet - userTicketCount;
    const maxQuantity = Math.min(remainingTickets, remainingForUser);
    const hasReachedLimit = remainingForUser <= 0;
    const totalPrice = ticketPrice * BigInt(quantity);


    // Refetch event data after purchase
    const refetchEvent = async () => {
        try {
            const response = await fetch(`/api/events/${eventId}`);
            if (response.ok) {
                const data = await response.json();
                setDbEvent(data.event);
            }
            // Also refetch user's ticket count
            if (address && dbEvent?.contract_address) {
                const ticketResponse = await fetch(`/api/tickets?owner=${address}&contract=${dbEvent.contract_address}`);
                if (ticketResponse.ok) {
                    const ticketData = await ticketResponse.json();
                    setUserTicketCount(ticketData.tickets?.length || 0);
                }
            }
        } catch (err) {
            console.error("Failed to refetch event:", err);
        }
    };

    const handlePurchase = async () => {
        if (!isConnected || !address || !contractAddress || !publicClient) return;

        setTxStatus("pending");
        setTxError(null);

        try {
            txToast.pending("Purchasing ticket...");

            let hash: `0x${string}`;

            if (quantity === 1) {
                hash = await writeContractAsync({
                    address: contractAddress,
                    abi: EventTicketABI,
                    functionName: "purchaseTicket",
                    value: totalPrice,
                });
            } else {
                hash = await writeContractAsync({
                    address: contractAddress,
                    abi: EventTicketABI,
                    functionName: "purchaseTickets",
                    args: [BigInt(quantity)],
                    value: totalPrice,
                });
            }

            // Wait for transaction receipt to get token IDs
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            // Parse Transfer events to get token IDs
            const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
            const tokenIds: bigint[] = [];

            for (const log of receipt.logs) {
                if (
                    log.address.toLowerCase() === contractAddress.toLowerCase() &&
                    log.topics[0] === transferEventSignature &&
                    log.topics[2]?.toLowerCase() === `0x000000000000000000000000${address.slice(2).toLowerCase()}`
                ) {
                    const tokenId = BigInt(log.topics[3] || "0");
                    tokenIds.push(tokenId);
                }
            }

            setTxStatus("success");
            txToast.success(quantity === 1 ? "Ticket purchased!" : `${quantity} tickets purchased!`);

            // Sync to database
            for (const tokenId of tokenIds) {
                await syncTicket({
                    token_id: tokenId.toString(),
                    event_contract_address: contractAddress,
                    event_id: dbEvent?.id,
                    owner_address: address,
                    purchase_price: ticketPrice.toString(),
                    purchase_tx_hash: hash,
                    action: "mint",
                });

                await syncTransaction({
                    tx_hash: hash,
                    tx_type: "purchase",
                    user_address: address,
                    token_id: tokenId.toString(),
                    event_contract_address: contractAddress,
                    event_id: dbEvent?.id,
                    amount: ticketPrice.toString(),
                    from_address: "0x0000000000000000000000000000000000000000",
                    to_address: address,
                    tx_timestamp: new Date().toISOString(),
                });
            }

            // Refetch to update sold count
            await refetchEvent();
        } catch (err) {
            setTxStatus("error");
            const message = err instanceof Error ? err.message : "Transaction failed";
            setTxError(message);
            txToast.error(message);
        }
    };

    // Format date from DB
    const eventDate = dbEvent?.date ? new Date(dbEvent.date) : null;
    const formattedDate = eventDate
        ? eventDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        })
        : "";
    const formattedTime = eventDate
        ? eventDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse">
                        <div className="h-64 bg-slate-800/50 rounded-xl mb-8" />
                        <div className="h-10 bg-slate-800/50 rounded w-2/3 mb-4" />
                        <div className="h-6 bg-slate-800/50 rounded w-1/3 mb-8" />
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="h-24 bg-slate-800/50 rounded-lg" />
                            <div className="h-24 bg-slate-800/50 rounded-lg" />
                        </div>
                        <div className="h-48 bg-slate-800/50 rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    // Event not found
    if (!dbEvent) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Event Not Found</h1>
                    <p className="text-gray-400 mb-6">The event you&apos;re looking for doesn&apos;t exist or has been removed.</p>
                    <Link href="/events" className="text-purple-400 hover:text-purple-300 underline">
                        Browse all events
                    </Link>
                </div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back Link */}
                <Link href="/events" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Events
                </Link>

                {/* Cover Image */}
                {dbEvent.cover_image_url && (
                    <div
                        className="relative h-40 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 overflow-hidden cursor-pointer group"
                        onClick={() => {
                            setHeroLightboxImage(dbEvent.cover_image_url);
                            setHeroLightboxOpen(true);
                        }}
                    >
                        <img src={dbEvent.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Event Header */}
                <div className={`relative h-64 rounded-xl overflow-hidden mb-8 bg-gradient-to-br from-purple-600/20 to-pink-600/20 ${dbEvent.cover_image_url ? "-mt-16" : ""}`}>
                    {dbEvent.image_url ? (
                        <div
                            className="w-full h-full cursor-pointer group"
                            onClick={() => {
                                setHeroLightboxImage(dbEvent.image_url);
                                setHeroLightboxOpen(true);
                            }}
                        >
                            <img
                                src={dbEvent.image_url}
                                alt={dbEvent.name}
                                className="w-full h-full object-cover"
                            />
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-24 h-24 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>
                    )}
                    {isSoldOut && (
                        <div className="absolute top-4 right-4 px-4 py-2 bg-red-500/90 text-white font-semibold rounded-full">
                            Sold Out
                        </div>
                    )}
                </div>

                {/* Event Title */}
                <div className="flex items-start justify-between gap-4 mb-2">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white">
                        {dbEvent.name}
                    </h1>
                    <button
                        onClick={() => {
                            document.getElementById('get-tickets-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all duration-300 cursor-pointer flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        Get Tickets
                    </button>
                </div>

                {/* Organizer */}
                <p className="text-gray-400 mb-6">
                    Organized by{" "}
                    {address?.toLowerCase() === dbEvent.organizer_address.toLowerCase() ? (
                        <span className="text-purple-400 font-medium">You</span>
                    ) : (
                        <span className="text-purple-400 font-mono text-sm">
                            {dbEvent.organizer_address.slice(0, 6)}...{dbEvent.organizer_address.slice(-4)}
                        </span>
                    )}
                </p>

                {/* Event Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Date & Time</p>
                                <p className="text-white font-medium">{formattedDate}</p>
                                <p className="text-gray-400 text-sm">{formattedTime} {dbEvent.timezone && `(${dbEvent.timezone})`}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                                {dbEvent.event_type === 'online' ? (
                                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    {dbEvent.event_type === 'online' ? 'Online Event' : 'Venue'}
                                </p>
                                <p className="text-white font-medium">{dbEvent.venue || "TBA"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Event Description */}
                {dbEvent.description && (
                    <div className="mb-8 bg-slate-800/50 rounded-lg p-5 border border-white/10">
                        <h2 className="text-lg font-semibold text-white mb-3">About this event</h2>
                        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{dbEvent.description}</p>
                    </div>
                )}

                {/* Media Gallery */}
                {dbEvent.media_files && Array.isArray(dbEvent.media_files) && dbEvent.media_files.length > 0 && (
                    <div className="mb-8 bg-slate-800/50 rounded-lg p-5 border border-white/10">
                        <h2 className="text-lg font-semibold text-white mb-4">Event Gallery</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {dbEvent.media_files.map((media, index) => (
                                <div
                                    key={index}
                                    className="relative aspect-video rounded-lg overflow-hidden bg-slate-900/50 cursor-pointer group"
                                    onClick={() => {
                                        setCarouselIndex(index);
                                        setCarouselOpen(true);
                                    }}
                                >
                                    {media.type === "video" ? (
                                        media.url ? (
                                            <video src={media.url} className="w-full h-full object-cover pointer-events-none" muted />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )
                                    ) : media.url ? (
                                        <img src={media.url} alt="Event media" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    )}
                                    {media.type === "video" && (
                                        <div className="absolute top-2 left-2 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-1">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                            <span className="text-xs text-white">Video</span>
                                        </div>
                                    )}
                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Gallery Carousel Modal */}
                {carouselOpen && dbEvent.media_files && Array.isArray(dbEvent.media_files) && (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center"
                        onClick={() => setCarouselOpen(false)}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setCarouselOpen(false)}
                            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Previous button */}
                        {dbEvent.media_files.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCarouselIndex((prev) => (prev === 0 ? dbEvent.media_files!.length - 1 : prev - 1));
                                }}
                                className="absolute left-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}

                        {/* Next button */}
                        {dbEvent.media_files.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCarouselIndex((prev) => (prev === dbEvent.media_files!.length - 1 ? 0 : prev + 1));
                                }}
                                className="absolute right-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {/* Media content */}
                        <div
                            className="max-w-5xl max-h-[85vh] w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {dbEvent.media_files[carouselIndex]?.type === "video" ? (
                                <video
                                    key={carouselIndex}
                                    src={dbEvent.media_files[carouselIndex]?.url}
                                    className="w-full max-h-[85vh] object-contain rounded-lg"
                                    controls
                                    autoPlay
                                />
                            ) : (
                                <img
                                    key={carouselIndex}
                                    src={dbEvent.media_files[carouselIndex]?.url}
                                    alt={`Gallery item ${carouselIndex + 1}`}
                                    className="w-full max-h-[85vh] object-contain rounded-lg"
                                />
                            )}
                        </div>

                        {/* Indicator dots */}
                        {dbEvent.media_files.length > 1 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                                {dbEvent.media_files.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCarouselIndex(index);
                                        }}
                                        className={`w-2.5 h-2.5 rounded-full transition-colors cursor-pointer ${index === carouselIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Counter */}
                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 rounded-full text-white text-sm">
                            {carouselIndex + 1} / {dbEvent.media_files.length}
                        </div>
                    </div>
                )}

                {/* Hero Image Lightbox Modal */}
                {heroLightboxOpen && heroLightboxImage && (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center"
                        onClick={() => setHeroLightboxOpen(false)}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setHeroLightboxOpen(false)}
                            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Image content */}
                        <div
                            className="max-w-5xl max-h-[85vh] w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={heroLightboxImage}
                                alt="Event image"
                                className="w-full max-h-[85vh] object-contain rounded-lg"
                            />
                        </div>
                    </div>
                )}

                {/* Ticket Details Section */}
                <div className="bg-slate-800/50 rounded-lg p-5 border border-white/10 mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Ticket Details</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {dbEvent.symbol && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Token Symbol</p>
                                <p className="text-white font-medium">{dbEvent.symbol}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max per Wallet</p>
                            <p className="text-white font-medium">{dbEvent.max_tickets_per_wallet || 5}</p>
                        </div>
                        {dbEvent.max_resale_price && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max Resale Price</p>
                                <p className="text-white font-medium">{dbEvent.max_resale_price} XTZ</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resale Royalty</p>
                            <p className="text-white font-medium">{dbEvent.royalty_percent || "0"}%</p>
                        </div>
                    </div>
                </div>

                {/* Royalty Recipients Section */}
                {royaltyRecipients.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-5 border border-white/10 mb-8">
                        <h2 className="text-lg font-semibold text-white mb-4">Royalty Recipients</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            When tickets are resold, royalties are distributed to the following recipients:
                        </p>
                        <div className="space-y-3">
                            {royaltyRecipients.map((recipient) => (
                                <div
                                    key={recipient.id}
                                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            {recipient.recipient_name && (
                                                <p className="text-white font-medium text-sm">{recipient.recipient_name}</p>
                                            )}
                                            <p className="text-gray-400 font-mono text-xs">
                                                {recipient.recipient_address.slice(0, 6)}...{recipient.recipient_address.slice(-4)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
                                            {recipient.percentage}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Total Royalty Distribution</span>
                            <span className="text-white font-medium">
                                {royaltyRecipients.reduce((sum, r) => sum + r.percentage, 0)}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Purchase Section */}
                <div id="get-tickets-section" className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                    <h2 className="text-xl font-semibold text-white mb-6">Get Tickets</h2>

                    {/* Ticket Availability */}
                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Price per ticket</p>
                            <p className="text-2xl font-bold text-white">
                                {dbEvent.ticket_price || "0"} XTZ
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Available</p>
                            <p className={`text-2xl font-bold ${isSoldOut ? 'text-red-400' : 'text-green-400'}`}>
                                {remainingTickets} / {totalSupply}
                            </p>
                        </div>
                    </div>

                    {/* Quantity Selector */}
                    {!isSoldOut && !hasReachedLimit && (
                        <div className="mb-6">
                            <label className="block text-sm text-gray-400 mb-2">
                                Quantity {isConnected && userTicketCount > 0 && (
                                    <span className="text-gray-500">
                                        (You own {userTicketCount}/{maxPerWallet})
                                    </span>
                                )}
                            </label>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    disabled={quantity <= 1 || txStatus === "pending"}
                                    className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                </button>
                                <span className="text-2xl font-bold text-white w-12 text-center">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                                    disabled={quantity >= maxQuantity || txStatus === "pending"}
                                    className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Total Price */}
                    {!isSoldOut && !hasReachedLimit && (
                        <div className="flex items-center justify-between mb-6 p-4 bg-slate-900/50 rounded-lg">
                            <span className="text-gray-400">Total</span>
                            <span className="text-xl font-bold text-white">
                                {formatEther(totalPrice)} XTZ
                            </span>
                        </div>
                    )}

                    {/* Transaction Status */}
                    {txStatus === "pending" && (
                        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <p className="text-blue-400">Processing transaction...</p>
                            </div>
                        </div>
                    )}

                    {txStatus === "success" && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <div>
                                    <p className="text-green-400 font-medium">Purchase successful!</p>
                                    <p className="text-green-400/70 text-sm">Your tickets have been minted to your wallet.</p>
                                </div>
                            </div>
                            <Link
                                href="/dashboard"
                                className="mt-3 inline-flex items-center gap-2 text-green-400 hover:text-green-300 text-sm"
                            >
                                View in My Tickets
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        </div>
                    )}

                    {txStatus === "error" && txError && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-red-400">{txError}</p>
                            </div>
                        </div>
                    )}

                    {/* Purchase Button */}
                    {!isConnected ? (
                        <p className="text-center text-gray-400 py-4">
                            Connect your wallet to purchase tickets
                        </p>
                    ) : isSoldOut ? (
                        <button
                            disabled
                            className="w-full py-4 bg-slate-700 text-gray-400 font-semibold rounded-lg cursor-not-allowed"
                        >
                            Sold Out
                        </button>
                    ) : hasReachedLimit ? (
                        <div className="text-center py-4">
                            <p className="text-yellow-400 mb-2">
                                You&apos;ve reached the maximum of {maxPerWallet} tickets per wallet
                            </p>
                            <p className="text-gray-500 text-sm">
                                You already own {userTicketCount} ticket{userTicketCount !== 1 ? 's' : ''} for this event
                            </p>
                        </div>
                    ) : !contractAddress ? (
                        <p className="text-center text-gray-400 py-4">
                            Event contract not deployed yet
                        </p>
                    ) : (
                        <button
                            onClick={handlePurchase}
                            disabled={txStatus === "pending"}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
                        >
                            {txStatus === "pending" ? "Processing..." : `Buy ${quantity} Ticket${quantity > 1 ? "s" : ""}`}
                        </button>
                    )}
                </div>

                {/* Contract Address */}
                {contractAddress && (
                    <div className="mt-6 text-center">
                        <p className="text-xs text-gray-500">
                            Contract:{" "}
                            <a
                                href={`https://shadownet.explorer.etherlink.com/address/${contractAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 font-mono"
                            >
                                {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
                            </a>
                        </p>
                    </div>
                )}

                {/* Comments Section */}
                <div className="mt-8">
                    <CommentSection eventId={eventId} />
                </div>
            </div>

            {/* Token-Gated Chat Room */}
            <ChatRoom
                eventId={eventId}
                contractAddress={contractAddress ?? null}
                organizerAddress={dbEvent.organizer_address}
            />
        </div>
    );
}
