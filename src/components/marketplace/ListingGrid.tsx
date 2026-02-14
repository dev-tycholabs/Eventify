"use client";

import { useState, useMemo } from "react";
import type { MarketplaceListing } from "@/types/ticket";
import { ListingCard } from "./ListingCard";
import { ListingCardSkeleton } from "./ListingCardSkeleton";

interface EventInfo {
    name: string;
    date: Date;
    venue: string;
    image?: string;
}

interface ListingGridProps {
    listings: MarketplaceListing[];
    eventInfoMap?: Map<string, EventInfo>;
    isLoading?: boolean;
    currentUserAddress?: `0x${string}`;
    onBuy?: (listing: MarketplaceListing) => void;
    onCancel?: (listing: MarketplaceListing) => void;
    processingListingId?: bigint | null;
}

type SortOption = "newest" | "oldest" | "price_low" | "price_high";

export function ListingGrid({
    listings,
    eventInfoMap = new Map(),
    isLoading = false,
    currentUserAddress,
    onBuy,
    onCancel,
    processingListingId,
}: ListingGridProps) {
    const [sortBy, setSortBy] = useState<SortOption>("newest");
    const [filterEvent, setFilterEvent] = useState<string>("all");

    // Get unique events for filter dropdown
    const uniqueEvents = useMemo(() => {
        const events = new Map<string, string>();
        listings.forEach((listing) => {
            const eventInfo = eventInfoMap.get(listing.eventContractAddress);
            if (eventInfo) {
                events.set(listing.eventContractAddress, eventInfo.name);
            }
        });
        return Array.from(events.entries());
    }, [listings, eventInfoMap]);

    // Filter and sort listings
    const filteredListings = useMemo(() => {
        let result = [...listings];

        // Filter by event
        if (filterEvent !== "all") {
            result = result.filter((l) => l.eventContractAddress === filterEvent);
        }

        // Sort
        switch (sortBy) {
            case "newest":
                result.sort((a, b) => b.listedAt.getTime() - a.listedAt.getTime());
                break;
            case "oldest":
                result.sort((a, b) => a.listedAt.getTime() - b.listedAt.getTime());
                break;
            case "price_low":
                result.sort((a, b) => (a.price < b.price ? -1 : 1));
                break;
            case "price_high":
                result.sort((a, b) => (a.price > b.price ? -1 : 1));
                break;
        }

        return result;
    }, [listings, sortBy, filterEvent]);

    if (isLoading) {
        return (
            <div>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="h-10 bg-slate-700/50 rounded-lg w-40 animate-pulse" />
                    <div className="h-10 bg-slate-700/50 rounded-lg w-48 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <ListingCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <label htmlFor="sort" className="text-sm text-gray-400">
                        Sort by:
                    </label>
                    <select
                        id="sort"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="price_low">Price: Low to High</option>
                        <option value="price_high">Price: High to Low</option>
                    </select>
                </div>

                {uniqueEvents.length > 1 && (
                    <div className="flex items-center gap-2">
                        <label htmlFor="event" className="text-sm text-gray-400">
                            Event:
                        </label>
                        <select
                            id="event"
                            value={filterEvent}
                            onChange={(e) => setFilterEvent(e.target.value)}
                            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 max-w-[200px]"
                        >
                            <option value="all">All Events</option>
                            {uniqueEvents.map(([address, name]) => (
                                <option key={address} value={address}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="sm:ml-auto text-sm text-gray-400">
                    {filteredListings.length} listing{filteredListings.length !== 1 ? "s" : ""}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredListings.map((listing) => {
                    const eventInfo = eventInfoMap.get(listing.eventContractAddress);
                    const isOwner =
                        currentUserAddress?.toLowerCase() === listing.seller.toLowerCase();

                    return (
                        <ListingCard
                            key={listing.listingId.toString()}
                            listing={listing}
                            eventName={eventInfo?.name}
                            eventDate={eventInfo?.date}
                            venue={eventInfo?.venue}
                            eventImage={eventInfo?.image}
                            onBuy={onBuy}
                            onCancel={onCancel}
                            isOwner={isOwner}
                            isLoading={processingListingId === listing.listingId}
                        />
                    );
                })}
            </div>
        </div>
    );
}
