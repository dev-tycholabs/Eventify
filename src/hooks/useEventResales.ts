"use client";

import { useState, useCallback, useEffect } from "react";
import type { Tables } from "@/lib/supabase/types";

type MarketplaceListing = Tables<"marketplace_listings">;

export interface ResaleData {
    totalResales: number;
    soldResales: number;
    totalResaleVolume: bigint;
    listings: MarketplaceListing[];
}

export function useEventResales(eventId: string | null) {
    const [resaleData, setResaleData] = useState<ResaleData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchResales = useCallback(async () => {
        if (!eventId) {
            setResaleData(null);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/events/${eventId}`);

            if (!response.ok) {
                throw new Error("Failed to fetch event resales");
            }

            const { resaleListings } = await response.json() as { resaleListings: MarketplaceListing[] };

            if (!resaleListings || resaleListings.length === 0) {
                setResaleData({
                    totalResales: 0,
                    soldResales: 0,
                    totalResaleVolume: BigInt(0),
                    listings: [],
                });
                return;
            }

            const soldListings = resaleListings.filter((l) => l.status === "sold");
            const totalVolume = soldListings.reduce((sum, l) => sum + BigInt(l.price || "0"), BigInt(0));

            setResaleData({
                totalResales: resaleListings.length,
                soldResales: soldListings.length,
                totalResaleVolume: totalVolume,
                listings: resaleListings,
            });
        } catch (err) {
            console.error("Failed to fetch event resales:", err);
            setResaleData(null);
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchResales();
    }, [fetchResales]);

    return {
        resaleData,
        isLoading,
        refetch: fetchResales,
    };
}
