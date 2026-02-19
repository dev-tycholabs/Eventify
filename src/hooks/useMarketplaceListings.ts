"use client";

import { useState, useEffect, useCallback } from "react";
import type { MarketplaceListing } from "@/types/ticket";

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
    status: "active" | "sold" | "cancelled";
    buyer_address: string | null;
    listed_at: string;
    sold_at: string | null;
    cancelled_at: string | null;
    tx_hash: string | null;
    events: EventInfo | null;
}

interface UseMarketplaceListingsOptions {
    status?: "active" | "sold" | "cancelled";
    seller?: string;
    eventContract?: string;
    chainId?: number | null;
}

export function useMarketplaceListings(options: UseMarketplaceListingsOptions = {}) {
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [eventInfoMap, setEventInfoMap] = useState<Map<string, { name: string; date: Date; venue: string; image?: string }>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchListings = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (options.status) params.set("status", options.status);
            if (options.seller) params.set("seller", options.seller);
            if (options.eventContract) params.set("event_contract", options.eventContract);
            if (options.chainId) params.set("chain_id", String(options.chainId));

            const response = await fetch(`/api/marketplace?${params.toString()}`);
            if (!response.ok) {
                throw new Error("Failed to fetch listings");
            }

            const data = await response.json();
            const dbListings: DBListing[] = data.listings || [];

            // Transform DB listings to MarketplaceListing format
            const transformedListings: MarketplaceListing[] = dbListings.map((l) => ({
                listingId: BigInt(l.listing_id),
                tokenId: BigInt(l.token_id),
                eventContractAddress: l.event_contract_address as `0x${string}`,
                chainId: l.chain_id,
                seller: l.seller_address as `0x${string}`,
                price: BigInt(l.price),
                isActive: l.status === "active",
                listedAt: new Date(l.listed_at),
            }));

            // Build event info map from joined event data
            const newEventInfoMap = new Map<string, { name: string; date: Date; venue: string; image?: string }>();
            dbListings.forEach((l) => {
                if (l.events && !newEventInfoMap.has(l.event_contract_address.toLowerCase())) {
                    newEventInfoMap.set(l.event_contract_address.toLowerCase(), {
                        name: l.events.name,
                        date: l.events.date ? new Date(l.events.date) : new Date(),
                        venue: l.events.venue || "",
                        image: l.events.image_url || undefined,
                    });
                }
            });

            setListings(transformedListings);
            setEventInfoMap(newEventInfoMap);
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Unknown error"));
        } finally {
            setIsLoading(false);
        }
    }, [options.status, options.seller, options.eventContract, options.chainId]);

    useEffect(() => {
        fetchListings();
    }, [fetchListings]);

    return {
        listings,
        eventInfoMap,
        isLoading,
        error,
        refetch: fetchListings,
    };
}
