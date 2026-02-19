"use client";

import { useState, useMemo } from "react";
import type { MarketplaceListing } from "@/types/ticket";
import { ListingCard } from "./ListingCard";
import { ListingCardSkeleton } from "./ListingCardSkeleton";
import { StyledSelect } from "@/components/ui/StyledSelect";

const SORT_OPTIONS = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "price_low", label: "Price: Low to High" },
    { value: "price_high", label: "Price: High to Low" },
];

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
                <StyledSelect
                    label="Sort by:"
                    value={sortBy}
                    onChange={(val) => setSortBy(val as SortOption)}
                    options={SORT_OPTIONS}
                />

                {uniqueEvents.length > 1 && (
                    <StyledSelect
                        label="Event:"
                        value={filterEvent}
                        onChange={setFilterEvent}
                        options={[
                            { value: "all", label: "All Events" },
                            ...uniqueEvents.map(([address, name]) => ({
                                value: address,
                                label: name,
                            })),
                        ]}
                    />
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
