"use client";

import { formatEther } from "viem";
import type { MarketplaceListing } from "@/types/ticket";

interface ListingCardProps {
    listing: MarketplaceListing;
    eventName?: string;
    eventDate?: Date;
    venue?: string;
    eventImage?: string;
    onBuy?: (listing: MarketplaceListing) => void;
    isOwner?: boolean;
    onCancel?: (listing: MarketplaceListing) => void;
    isLoading?: boolean;
}

export function ListingCard({
    listing,
    eventName = "Event Ticket",
    eventDate,
    venue,
    eventImage,
    onBuy,
    isOwner = false,
    onCancel,
    isLoading = false,
}: ListingCardProps) {
    const formattedDate = eventDate?.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const truncatedSeller = `${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}`;
    const listedDate = listing.listedAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });

    return (
        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all duration-300">
            {/* Ticket Visual */}
            <div className="relative h-32 bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center">
                {eventImage ? (
                    <img
                        src={eventImage}
                        alt={eventName}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <svg
                        className="w-12 h-12 text-purple-400/50"
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
                <div className="absolute top-3 left-3 px-2 py-1 bg-purple-500/80 text-white text-xs font-semibold rounded">
                    #{listing.tokenId.toString()}
                </div>
            </div>

            {/* Listing Details */}
            <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-2 line-clamp-1">
                    {eventName}
                </h3>

                <div className="space-y-1.5 mb-3">
                    {formattedDate && (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{formattedDate}</span>
                        </div>
                    )}
                    {venue && (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="line-clamp-1">{venue}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Seller: {truncatedSeller}</span>
                    </div>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Price</p>
                        <p className="text-xl font-bold text-white">
                            {formatEther(listing.price)} XTZ
                        </p>
                    </div>
                    <p className="text-xs text-gray-500">Listed {listedDate}</p>
                </div>

                {/* Action Button */}
                <div className="mt-4">
                    {isOwner ? (
                        <button
                            onClick={() => onCancel?.(listing)}
                            disabled={isLoading}
                            className="w-full py-2.5 px-4 bg-red-500/20 text-red-400 font-semibold rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isLoading ? "Canceling..." : "Cancel Listing"}
                        </button>
                    ) : (
                        <button
                            onClick={() => onBuy?.(listing)}
                            disabled={isLoading}
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isLoading ? "Processing..." : "Buy Ticket"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
