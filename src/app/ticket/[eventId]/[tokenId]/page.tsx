"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import QRCode from "qrcode";
import { useTicketHistory } from "@/hooks/useTicketHistory";
import { useMarketplace } from "@/hooks/useMarketplace";
import { syncListing, syncTicket, syncTransaction } from "@/lib/api/sync";
import { ListTicketModal, TransferTicketModal } from "@/components/marketplace";
import { QRCodeModal } from "@/components/profile";
import { downloadTicketAsPNG, downloadTicketAsPDF } from "@/utils/ticketDownload";
import toast from "react-hot-toast";
import type { TransactionType } from "@/lib/supabase/types";
import { useChainConfig } from "@/hooks/useChainConfig";

interface TicketData {
    id: string;
    token_id: string;
    event_contract_address: string;
    owner_address: string;
    is_used: boolean;
    is_listed: boolean;
    listing_id: string | null;
    purchase_price: string | null;
    purchased_at: string;
    events: {
        id: string;
        name: string;
        date: string | null;
        venue: string | null;
        image_url: string | null;
        ticket_price: string | null;
        max_resale_price: string | null;
        organizer_address: string;
        description: string | null;
    } | null;
    marketplace_listing: {
        listing_id: string;
        price: string;
        status: string;
        seller_address: string;
    } | null;
}

export default function TicketDetailPage() {
    const params = useParams();
    const eventId = params.eventId as string;
    const tokenId = params.tokenId as string;
    const { address } = useAccount();
    const { explorerUrl: EXPLORER_URL, currencySymbol, chainId } = useChainConfig();

    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [showListModal, setShowListModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [isListingLoading, setIsListingLoading] = useState(false);
    const [isTransferLoading, setIsTransferLoading] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showOwnerQR, setShowOwnerQR] = useState(false);
    const [showTicketQR, setShowTicketQR] = useState(false);

    const { listTicket, cancelListing, transferTicket: transferTicketOnChain } = useMarketplace();

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // We need the contract address for history - will be set after ticket loads
    const contractAddress = ticket?.event_contract_address || "";

    const { history, isLoading: historyLoading } = useTicketHistory({
        tokenId,
        eventContractAddress: contractAddress,
        enabled: !!contractAddress && !!tokenId,
    });

    // Fetch ticket data using event ID
    useEffect(() => {
        async function fetchTicket() {
            if (!eventId || !tokenId) return;
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/tickets/by-event/${eventId}/${tokenId}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        setError("Ticket not found");
                    } else {
                        setError("Failed to load ticket");
                    }
                    return;
                }
                const data = await response.json();
                setTicket(data.ticket);
            } catch {
                setError("Failed to load ticket");
            } finally {
                setIsLoading(false);
            }
        }
        fetchTicket();
    }, [eventId, tokenId]);

    // Generate QR code
    useEffect(() => {
        if (!ticket) return;
        const generateQR = async () => {
            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
            const verifyUrl = `${baseUrl}/verify?contract=${ticket.event_contract_address}&tokenId=${ticket.token_id}&event=${encodeURIComponent(ticket.events?.name || "")}&chainId=${chainId}`;
            try {
                const dataUrl = await QRCode.toDataURL(verifyUrl, {
                    width: 200,
                    margin: 1,
                    color: { dark: "#1e1b4b", light: "#ffffff" },
                });
                setQrCodeDataUrl(dataUrl);
            } catch (err) {
                console.error("Error generating QR code:", err);
            }
        };
        generateQR();
    }, [ticket]);

    const handleDownloadPNG = async () => {
        if (!ticket) return;
        setIsDownloading(true);
        try {
            const fileName = `ticket-${ticket.events?.name?.replace(/\s+/g, "-") || "nft"}-${ticket.token_id}`;
            await downloadTicketAsPNG("downloadable-ticket", fileName);
            toast.success("Ticket downloaded as PNG!");
        } catch {
            toast.error("Failed to download ticket");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!ticket) return;
        setIsDownloading(true);
        try {
            const fileName = `ticket-${ticket.events?.name?.replace(/\s+/g, "-") || "nft"}-${ticket.token_id}`;
            await downloadTicketAsPDF("downloadable-ticket", fileName);
            toast.success("Ticket downloaded as PDF!");
        } catch {
            toast.error("Failed to download ticket");
        } finally {
            setIsDownloading(false);
        }
    };

    const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    // Refetch ticket data
    const refetchTicket = async () => {
        if (!eventId || !tokenId) return;
        try {
            const response = await fetch(`/api/tickets/by-event/${eventId}/${tokenId}`);
            if (response.ok) {
                const data = await response.json();
                setTicket(data.ticket);
            }
        } catch {
            // silently fail
        }
    };

    const ticketPrice = ticket?.events?.ticket_price
        ? BigInt(Math.floor(parseFloat(ticket.events.ticket_price) * 1e18))
        : BigInt(0);

    const maxResalePrice = ticket?.events?.max_resale_price
        ? BigInt(Math.floor(parseFloat(ticket.events.max_resale_price) * 1e18))
        : ticketPrice * BigInt(110) / BigInt(100);

    const handleListForSale = async (price: bigint) => {
        if (!ticket || !address) return;
        setIsListingLoading(true);
        try {
            const result = await listTicket(
                ticket.event_contract_address as `0x${string}`,
                BigInt(ticket.token_id),
                price
            );
            if (result !== null) {
                await refetchTicket();
                setShowListModal(false);
            }
        } catch (err) {
            console.error("Error listing ticket:", err);
        } finally {
            setIsListingLoading(false);
        }
    };

    const handleTransfer = async (toAddress: `0x${string}`) => {
        if (!ticket) return;
        setIsTransferLoading(true);
        try {
            const result = await transferTicketOnChain(
                ticket.event_contract_address as `0x${string}`,
                BigInt(ticket.token_id),
                toAddress
            );
            if (result.success) {
                await refetchTicket();
                setShowTransferModal(false);
            }
        } catch (err) {
            console.error("Error transferring ticket:", err);
        } finally {
            setIsTransferLoading(false);
        }
    };

    const handleCancelListing = async () => {
        if (!ticket || !ticket.listing_id || !address) return;
        setIsCancelling(true);
        try {
            const listingId = BigInt(ticket.listing_id);
            const result = await cancelListing(listingId);
            if (result.success) {
                await syncListing({
                    listing_id: ticket.listing_id,
                    token_id: ticket.token_id,
                    event_contract_address: ticket.event_contract_address,
                    event_id: eventId || undefined,
                    seller_address: address,
                    price: ticket.marketplace_listing?.price || ticket.purchase_price || "0",
                    action: "cancel",
                    chain_id: chainId,
                });
                if (result.txHash) {
                    await syncTransaction({
                        tx_hash: result.txHash,
                        tx_type: "cancel",
                        user_address: address,
                        token_id: ticket.token_id,
                        event_contract_address: ticket.event_contract_address,
                        event_id: eventId || undefined,
                        listing_id: ticket.listing_id,
                        tx_timestamp: new Date().toISOString(),
                        chain_id: chainId,
                    });
                }
                await syncTicket({
                    token_id: ticket.token_id,
                    event_contract_address: ticket.event_contract_address,
                    event_id: eventId || undefined,
                    owner_address: address,
                    is_listed: false,
                    action: "unlist",
                    chain_id: chainId,
                });
                await refetchTicket();
            }
        } catch (err) {
            console.error("Error cancelling listing:", err);
        } finally {
            setIsCancelling(false);
        }
    };

    const getTypeConfig = (type: TransactionType) => {
        const configs = {
            use: { icon: "M5 13l4 4L19 7", bg: "bg-cyan-500/20", color: "text-cyan-400", border: "border-cyan-500/30", label: "Used" },
            purchase: { icon: "M12 4v16m8-8H4", bg: "bg-green-500/20", color: "text-green-400", border: "border-green-500/30", label: "Purchased" },
            sale: { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-purple-500/20", color: "text-purple-400", border: "border-purple-500/30", label: "Sold" },
            listing: { icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z", bg: "bg-orange-500/20", color: "text-orange-400", border: "border-orange-500/30", label: "Listed" },
            transfer: { icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", bg: "bg-blue-500/20", color: "text-blue-400", border: "border-blue-500/30", label: "Transferred" },
            cancel: { icon: "M6 18L18 6M6 6l12 12", bg: "bg-red-500/20", color: "text-red-400", border: "border-red-500/30", label: "Cancelled" },
        };
        return configs[type] || configs.purchase;
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse">
                        <div className="h-6 bg-slate-800/50 rounded w-32 mb-8" />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="h-[500px] bg-slate-800/50 rounded-xl" />
                            <div className="space-y-4">
                                <div className="h-8 bg-slate-800/50 rounded w-2/3" />
                                <div className="h-4 bg-slate-800/50 rounded w-1/3" />
                                <div className="h-64 bg-slate-800/50 rounded-xl mt-8" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !ticket) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Ticket Not Found</h1>
                    <p className="text-gray-400 mb-6">{error || "This ticket doesn't exist or has been removed."}</p>
                    <Link href="/dashboard" className="text-purple-400 hover:text-purple-300 underline">
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const eventDate = ticket.events?.date ? new Date(ticket.events.date) : null;
    const isPastEvent = eventDate ? eventDate < new Date() : false;
    const isOwner = address?.toLowerCase() === ticket.owner_address.toLowerCase();

    const getStatusInfo = () => {
        if (ticket.is_used) return { label: "Used", color: "bg-gray-500", textColor: "text-gray-400" };
        if (ticket.is_listed) return { label: "Listed for Sale", color: "bg-orange-500", textColor: "text-orange-400" };
        if (isPastEvent) return { label: "Event Passed", color: "bg-red-500", textColor: "text-red-400" };
        return { label: "Valid", color: "bg-green-500", textColor: "text-green-400" };
    };
    const status = getStatusInfo();

    return (
        <>
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Navigation Links */}
                    <div className="flex items-center gap-4 mb-6">
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </Link>
                        <span className="text-gray-600">|</span>
                        <Link href={`/events/${eventId}`} className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Go to Event
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column - Ticket Card */}
                        <div>
                            <div id="downloadable-ticket" className="bg-slate-800/50 rounded-2xl border border-white/10 overflow-hidden">
                                {/* Ticket Header */}
                                <div className="relative h-40 bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                                    {ticket.events?.image_url ? (
                                        <img src={ticket.events.image_url} alt={ticket.events.name || ""} className="w-full h-full object-cover" />
                                    ) : (
                                        <svg className="w-20 h-20 text-purple-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                        </svg>
                                    )}
                                </div>

                                <div className="p-6">
                                    {/* Status */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={`w-2 h-2 rounded-full ${status.color}`} />
                                        <span className={`text-sm font-medium ${status.textColor}`}>{status.label}</span>
                                        {isOwner && <span className="ml-auto text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">You own this</span>}
                                    </div>

                                    {/* Event Name */}
                                    <h1 className="text-2xl font-bold text-white mb-1">{ticket.events?.name || "Event Ticket"}</h1>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                                            <span>Ticket #{ticket.token_id}</span>
                                            <button
                                                onClick={() => copyToClipboard(ticket.token_id, "tokenId")}
                                                className="p-1 hover:bg-slate-700/50 rounded transition-colors cursor-pointer"
                                                title="Copy Token ID"
                                            >
                                                {copiedField === "tokenId" ? (
                                                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                )}
                                            </button>
                                            {qrCodeDataUrl && (
                                                <button
                                                    onClick={() => setShowTicketQR(true)}
                                                    className="p-1 hover:bg-slate-700/50 rounded transition-colors cursor-pointer"
                                                    title="View Ticket QR Code"
                                                >
                                                    <svg className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        {isOwner && (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                                    disabled={isDownloading}
                                                    className={`px-3 py-1.5 bg-slate-800/50 border rounded-lg text-left focus:outline-none cursor-pointer flex items-center gap-2 transition-colors disabled:opacity-50 ${showDownloadMenu ? "border-purple-500 ring-2 ring-purple-500" : "border-white/10 hover:border-white/20"}`}
                                                >
                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    <span className="text-sm text-white">Download</span>
                                                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDownloadMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                                {showDownloadMenu && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)} />
                                                        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                                                            <button
                                                                onClick={() => { handleDownloadPNG(); setShowDownloadMenu(false); }}
                                                                className="w-full px-4 py-3 text-left transition-colors cursor-pointer flex items-center gap-3 hover:bg-slate-700"
                                                            >
                                                                <span className="text-gray-400">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                </span>
                                                                <div>
                                                                    <div className="text-sm font-medium text-white">PNG Image</div>
                                                                    <div className="text-xs text-gray-500">High quality image file</div>
                                                                </div>
                                                            </button>
                                                            <button
                                                                onClick={() => { handleDownloadPDF(); setShowDownloadMenu(false); }}
                                                                className="w-full px-4 py-3 text-left transition-colors cursor-pointer flex items-center gap-3 hover:bg-slate-700 border-t border-white/5"
                                                            >
                                                                <span className="text-gray-400">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                                    </svg>
                                                                </span>
                                                                <div>
                                                                    <div className="text-sm font-medium text-white">PDF Document</div>
                                                                    <div className="text-xs text-gray-500">Printable document file</div>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons - List / Transfer / Cancel */}
                                    {isOwner && (
                                        <div className="flex flex-col gap-3 mb-6">
                                            {!ticket.is_used && !ticket.is_listed && !isPastEvent && (
                                                <>
                                                    <button
                                                        onClick={() => setShowListModal(true)}
                                                        className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm cursor-pointer"
                                                    >
                                                        List for Sale
                                                    </button>
                                                    <button
                                                        onClick={() => setShowTransferModal(true)}
                                                        className="w-full py-2.5 px-3 bg-blue-500/20 border border-blue-500/50 text-blue-400 font-semibold rounded-lg hover:bg-blue-500/30 transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                        </svg>
                                                        Transfer
                                                    </button>
                                                </>
                                            )}
                                            {ticket.is_used && !ticket.is_listed && (
                                                <button
                                                    onClick={() => setShowTransferModal(true)}
                                                    className="w-full py-2.5 px-3 bg-blue-500/20 border border-blue-500/50 text-blue-400 font-semibold rounded-lg hover:bg-blue-500/30 transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                    </svg>
                                                    Transfer
                                                </button>
                                            )}
                                            {ticket.is_listed && !ticket.is_used && (
                                                <button
                                                    onClick={handleCancelListing}
                                                    disabled={isCancelling}
                                                    className="w-full py-2.5 px-4 bg-red-500/20 border border-red-500/50 text-red-400 font-semibold rounded-lg hover:bg-red-500/30 transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isCancelling ? "Cancelling..." : "Cancel Listing"}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Event Details */}
                                    <div className="space-y-4 mb-6">
                                        {eventDate && (
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Date & Time</p>
                                                    <p className="text-white font-medium">{eventDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                                                    <p className="text-gray-400 text-sm">{eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                                                </div>
                                            </div>
                                        )}

                                        {ticket.events?.venue && (
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Venue</p>
                                                    <p className="text-white font-medium">{ticket.events.venue}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide">Current Owner</p>
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-white font-medium font-mono">{formatAddress(ticket.owner_address)}</p>
                                                    <button
                                                        onClick={() => copyToClipboard(ticket.owner_address, "owner")}
                                                        className="p-1 hover:bg-slate-700/50 rounded transition-colors cursor-pointer"
                                                        title="Copy Owner Address"
                                                    >
                                                        {copiedField === "owner" ? (
                                                            <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => setShowOwnerQR(true)}
                                                        className="p-1 hover:bg-slate-700/50 rounded transition-colors cursor-pointer"
                                                        title="View QR Code"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {ticket.purchase_price && (
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Purchase Price</p>
                                                    <p className="text-white font-medium">{formatEther(BigInt(ticket.purchase_price))} {currencySymbol}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* QR Code */}
                                    {!ticket.is_used && !isPastEvent && qrCodeDataUrl && (
                                        <div className="bg-white rounded-xl p-4 mb-6">
                                            <div className="flex flex-col items-center">
                                                <img src={qrCodeDataUrl} alt="Ticket QR Code" className="w-40 h-40 mb-2" />
                                                <p className="text-gray-600 text-xs text-center">Scan at event entrance</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Contract Info */}
                                    <div className="bg-slate-900/50 rounded-lg p-4">
                                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contract Address</p>
                                        <div className="flex items-start gap-2">
                                            <a href={`${EXPLORER_URL}/address/${ticket.event_contract_address}`} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm font-mono break-all flex-1">
                                                {ticket.event_contract_address}
                                            </a>
                                            <button
                                                onClick={() => copyToClipboard(ticket.event_contract_address, "contract")}
                                                className="p-1.5 hover:bg-slate-700/50 rounded transition-colors cursor-pointer flex-shrink-0"
                                                title="Copy Contract Address"
                                            >
                                                {copiedField === "contract" ? (
                                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Token ID Info */}
                                    <div className="bg-slate-900/50 rounded-lg p-4 mt-3">
                                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Token ID</p>
                                        <div className="flex items-start gap-2">
                                            <span className="text-purple-400 text-sm font-mono break-all flex-1">
                                                {ticket.token_id}
                                            </span>
                                            <button
                                                onClick={() => copyToClipboard(ticket.token_id, "tokenIdBottom")}
                                                className="p-1.5 hover:bg-slate-700/50 rounded transition-colors cursor-pointer flex-shrink-0"
                                                title="Copy Token ID"
                                            >
                                                {copiedField === "tokenIdBottom" ? (
                                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - History Timeline */}
                        <div>
                            <div className="bg-slate-800/50 rounded-2xl border border-white/10 p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Ticket History</h2>
                                        <p className="text-gray-400 text-sm">Complete ownership & activity timeline</p>
                                    </div>
                                </div>

                                {historyLoading ? (
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
                                ) : history.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-400">No history found for this ticket</p>
                                    </div>
                                ) : (
                                    <div className="relative max-h-[600px] overflow-y-auto pr-1">
                                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />
                                        <div className="space-y-6">
                                            {history.map((entry, index) => {
                                                const config = getTypeConfig(entry.txType);
                                                const isFirst = index === 0;
                                                return (
                                                    <div key={entry.id} className="relative flex gap-4 pl-1">
                                                        <div className={`relative z-10 w-8 h-8 rounded-full ${config.bg} flex items-center justify-center border-2 ${config.border} ${isFirst ? "ring-2 ring-offset-2 ring-offset-slate-800 ring-purple-500/50" : ""}`}>
                                                            <svg className={`w-4 h-4 ${config.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1 pb-2">
                                                            <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5">
                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                    <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                                                                    <span className="text-xs text-gray-500">{entry.txTimestamp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                                                </div>
                                                                <p className="text-gray-300 text-sm mb-1">By {formatAddress(entry.userAddress)}</p>
                                                                {entry.amount && <p className="text-gray-400 text-sm">Price: <span className="text-white font-medium">{formatEther(entry.amount)} {currencySymbol}</span></p>}
                                                                {entry.txHash && !entry.txHash.startsWith("list-") && !entry.txHash.startsWith("buy-") && !entry.txHash.startsWith("cancel-") && (
                                                                    <a href={`${EXPLORER_URL}/tx/${entry.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-2">
                                                                        View tx <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
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
                        </div>
                    </div>
                </div>
            </div>

            {/* List Ticket Modal */}
            <ListTicketModal
                isOpen={showListModal}
                onClose={() => setShowListModal(false)}
                onSubmit={handleListForSale}
                tokenId={BigInt(ticket.token_id)}
                eventName={ticket.events?.name || ""}
                originalPrice={ticketPrice || undefined}
                maxResalePrice={maxResalePrice || undefined}
                isLoading={isListingLoading}
            />

            {/* Transfer Ticket Modal */}
            <TransferTicketModal
                isOpen={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                onSubmit={handleTransfer}
                tokenId={BigInt(ticket.token_id)}
                eventName={ticket.events?.name || ""}
                isLoading={isTransferLoading}
            />

            {/* Owner QR Code Modal */}
            <QRCodeModal
                isOpen={showOwnerQR}
                onClose={() => setShowOwnerQR(false)}
                walletAddress={ticket.owner_address}
                title={isOwner ? "My QR Code" : "Owner QR Code"}
                subtitle={isOwner ? "Scan to get my wallet address" : "Scan to get the owner's wallet address"}
            />

            {/* Ticket QR Code Modal */}
            <QRCodeModal
                isOpen={showTicketQR}
                onClose={() => setShowTicketQR(false)}
                qrImageUrl={qrCodeDataUrl}
                title="Ticket QR Code"
                subtitle="Scan at event entrance to verify"
                label={ticket.events?.name || "Event Ticket"}
                sublabel={`Ticket #${ticket.token_id}`}
                downloadName={`ticket-${ticket.events?.name?.replace(/\s+/g, "-") || "nft"}-${ticket.token_id}`}
            />
        </>
    );
}
