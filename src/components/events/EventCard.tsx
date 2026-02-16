"use client";

import Link from "next/link";
import { formatEther } from "viem";
import type { Event } from "@/types/event";
import { getNativeCurrencySymbol, SUPPORTED_CHAINS } from "@/config/chains";

interface EventCardProps {
    event: Event;
    showDistance?: boolean;
}

export function EventCard({ event, showDistance }: EventCardProps) {
    const currencySymbol = getNativeCurrencySymbol(event.chainId);
    const chainName = SUPPORTED_CHAINS.find(c => c.id === event.chainId)?.name;
    const formattedDate = event.date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const formattedTime = event.date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });

    const ticketsRemaining = event.totalSupply - event.soldCount;
    const isSoldOut = ticketsRemaining <= 0;
    const isLowStock = ticketsRemaining > 0 && ticketsRemaining <= 10;

    return (
        <Link href={`/events/${event.id}`}>
            <div className="group bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
                {/* Event Image */}
                <div className="relative h-48 bg-gradient-to-br from-purple-600/20 to-pink-600/20">
                    {event.imageUrl ? (
                        <img
                            src={event.imageUrl}
                            alt={event.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <svg
                                className="w-16 h-16 text-purple-400/50"
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
                        </div>
                    )}

                    {/* Status Badge */}
                    {isSoldOut && (
                        <div className="absolute top-3 right-3 px-3 py-1 bg-red-500/90 text-white text-xs font-semibold rounded-full">
                            Sold Out
                        </div>
                    )}
                    {isLowStock && !isSoldOut && (
                        <div className="absolute top-3 right-3 px-3 py-1 bg-orange-500/90 text-white text-xs font-semibold rounded-full">
                            Only {ticketsRemaining} left
                        </div>
                    )}
                    {showDistance && event.distance_km != null && (
                        <div className="absolute top-3 left-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-sm text-gray-200 text-xs font-medium rounded-full flex items-center gap-1">
                            <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            {event.distance_km < 1
                                ? "< 1 km"
                                : `${Math.round(event.distance_km)} km`}
                        </div>
                    )}
                    {/* Chain Badge */}
                    {chainName && (
                        <div className={`absolute ${showDistance && event.distance_km != null ? 'bottom-3' : 'top-3'} left-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-sm text-gray-200 text-xs font-medium rounded-full`}>
                            {chainName}
                        </div>
                    )}
                </div>

                {/* Event Details */}
                <div className="p-5">
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors line-clamp-1">
                        {event.name}
                    </h3>

                    <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{formattedDate} at {formattedTime}</span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="line-clamp-1">
                                {event.venue}
                                {event.city ? `, ${event.city}` : ""}
                            </span>
                        </div>
                    </div>

                    {/* Price and Availability */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Price</p>
                            <p className="text-lg font-bold text-white">
                                {formatEther(event.ticketPrice)} {currencySymbol}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Available</p>
                            <p className={`text-lg font-bold ${isSoldOut ? 'text-red-400' : isLowStock ? 'text-orange-400' : 'text-green-400'}`}>
                                {ticketsRemaining} / {event.totalSupply}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
