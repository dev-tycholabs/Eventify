"use client";

import { SUPPORTED_CHAINS } from "@/config/chains";

interface UserTicket {
    tokenId: bigint;
    eventContractAddress: `0x${string}`;
    eventName: string;
    eventDate: Date;
    venue: string;
    isUsed: boolean;
    isListed: boolean;
    ticketPrice: bigint;
    imageUrl?: string;
    chainId: number;
}

interface TicketCardProps {
    ticket: UserTicket;
    onClick: () => void;
    onListForSale: () => void;
    onTransfer: () => void;
    onCancelListing?: () => void;
    isCancelling?: boolean;
}

export function TicketCard({
    ticket,
    onClick,
    onListForSale,
    onTransfer,
    onCancelListing,
    isCancelling,
}: TicketCardProps) {
    const formattedDate = ticket.eventDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const isPastEvent = ticket.eventDate < new Date();

    const chainName = SUPPORTED_CHAINS.find((c) => c.id === ticket.chainId)?.name || "Unknown Chain";

    const getStatusBadge = () => {
        if (ticket.isUsed) {
            return (
                <span className="px-2 py-1 bg-gray-500/80 text-white text-xs font-semibold rounded">
                    Used
                </span>
            );
        }
        if (ticket.isListed) {
            return (
                <span className="px-2 py-1 bg-orange-500/80 text-white text-xs font-semibold rounded">
                    Listed
                </span>
            );
        }
        if (isPastEvent) {
            return (
                <span className="px-2 py-1 bg-red-500/80 text-white text-xs font-semibold rounded">
                    Expired
                </span>
            );
        }
        return (
            <span className="px-2 py-1 bg-green-500/80 text-white text-xs font-semibold rounded">
                Valid
            </span>
        );
    };

    const canList = !ticket.isUsed && !ticket.isListed && !isPastEvent;
    const canTransfer = !ticket.isListed; // Used tickets can still be transferred

    return (
        <div
            className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all duration-300 cursor-pointer group"
            onClick={onClick}
        >
            {/* Ticket Visual */}
            <div className="relative h-40 bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center overflow-hidden">
                {ticket.imageUrl ? (
                    <img
                        src={ticket.imageUrl}
                        alt={ticket.eventName}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <svg
                        className="w-16 h-16 text-purple-400/50 group-hover:text-purple-400/70 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                        />
                    </svg>
                )}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {getStatusBadge()}
                    <div className="px-2 py-1 bg-purple-600/80 text-white text-xs font-semibold rounded">
                        {chainName}
                    </div>
                </div>
                <div className="absolute top-3 right-3">
                    <div className="px-2 py-1 bg-slate-900/80 text-white text-xs font-mono rounded">
                        #{ticket.tokenId.toString()}
                    </div>
                </div>
                {/* View Details overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                    </span>
                </div>
            </div>

            {/* Ticket Details */}
            <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-3 line-clamp-1">
                    {ticket.eventName}
                </h3>

                <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="line-clamp-1">{ticket.venue}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                {canList && (
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onListForSale();
                            }}
                            className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm cursor-pointer"
                        >
                            List for Sale
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTransfer();
                            }}
                            className="w-full py-2.5 px-3 bg-blue-500/20 border border-blue-500/50 text-blue-400 font-semibold rounded-lg hover:bg-blue-500/30 transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Transfer
                        </button>
                    </div>
                )}
                {/* Show Transfer button for used tickets (not listed) */}
                {ticket.isUsed && canTransfer && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onTransfer();
                        }}
                        className="w-full py-2.5 px-3 bg-blue-500/20 border border-blue-500/50 text-blue-400 font-semibold rounded-lg hover:bg-blue-500/30 transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Transfer
                    </button>
                )}
                {ticket.isListed && !ticket.isUsed && onCancelListing && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancelListing();
                        }}
                        disabled={isCancelling}
                        className="w-full py-2.5 px-4 bg-red-500/20 border border-red-500/50 text-red-400 font-semibold rounded-lg hover:bg-red-500/30 transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCancelling ? "Cancelling..." : "Cancel Listing"}
                    </button>
                )}
            </div>
        </div>
    );
}
