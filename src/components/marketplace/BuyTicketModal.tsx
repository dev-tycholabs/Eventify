"use client";

import { formatEther } from "viem";
import type { MarketplaceListing } from "@/types/ticket";

interface BuyTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    listing: MarketplaceListing | null;
    eventName?: string;
    eventDate?: Date;
    venue?: string;
    isLoading?: boolean;
}

export function BuyTicketModal({
    isOpen,
    onClose,
    onConfirm,
    listing,
    eventName = "Event Ticket",
    eventDate,
    venue,
    isLoading = false,
}: BuyTicketModalProps) {
    if (!isOpen || !listing) return null;

    const formattedDate = eventDate?.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    const truncatedSeller = `${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}`;

    const handleConfirm = async () => {
        await onConfirm();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white mb-1">Confirm Purchase</h2>
                    <p className="text-gray-400 text-sm">Review the details before buying</p>
                </div>

                {/* Ticket Details */}
                <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center flex-shrink-0">
                            <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-semibold text-lg">{eventName}</p>
                            <p className="text-purple-400 text-sm">Ticket #{listing.tokenId.toString()}</p>
                        </div>
                    </div>

                    <div className="space-y-2 text-sm">
                        {formattedDate && (
                            <div className="flex items-center gap-2 text-gray-400">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{formattedDate}</span>
                            </div>
                        )}
                        {venue && (
                            <div className="flex items-center gap-2 text-gray-400">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{venue}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Seller: {truncatedSeller}</span>
                        </div>
                    </div>
                </div>

                {/* Price Summary */}
                <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-400">Total Price</span>
                        <span className="text-2xl font-bold text-white">
                            {formatEther(listing.price)} XTZ
                        </span>
                    </div>
                </div>

                {/* Info */}
                <div className="mb-6 text-xs text-gray-500">
                    <p>By confirming, you will send {formatEther(listing.price)} XTZ to purchase this ticket. The NFT will be transferred to your wallet upon successful transaction.</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-3 px-4 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            "Confirm Purchase"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
