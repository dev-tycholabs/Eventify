"use client";

import { useState, useCallback, useEffect } from "react";
import type { Tables } from "@/lib/supabase/types";
import type { Event } from "@/types/event";
import { ErrorCode, type AppError } from "@/types/errors";

type DBEvent = Tables<"events">;

interface UseEventsFromDBOptions {
    status?: "draft" | "published";
    organizer?: string;
    autoFetch?: boolean;
    lat?: number | null;
    lon?: number | null;
    radius?: number | null;
    sortByDistance?: boolean;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    date?: string | null;
    chainId?: number | null;
}

export function useEventsFromDB(options: UseEventsFromDBOptions = {}) {
    const {
        status = "published",
        organizer,
        autoFetch = true,
        lat,
        lon,
        radius,
        sortByDistance,
        city,
        state,
        country,
        chainId,
    } = options;

    const date = options.date ?? null;

    const [events, setEvents] = useState<Event[]>([]);
    const [rawEvents, setRawEvents] = useState<DBEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<AppError | null>(null);

    const fetchEvents = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (status) params.set("status", status);
            if (organizer) params.set("organizer", organizer);
            if (lat != null && lon != null) {
                params.set("lat", String(lat));
                params.set("lon", String(lon));
            }
            if (radius != null) params.set("radius", String(radius));
            if (sortByDistance) params.set("sort", "distance");
            if (city) params.set("city", city);
            if (state) params.set("state", state);
            if (country) params.set("country", country);
            if (date) params.set("date", date);
            if (chainId) params.set("chain_id", String(chainId));

            const response = await fetch(`/api/events?${params.toString()}`);

            if (!response.ok) {
                throw new Error("Failed to fetch events");
            }

            const data = await response.json();
            const dbEvents: DBEvent[] = data.events || [];

            setRawEvents(dbEvents);

            // Transform DB events to Event type
            const transformedEvents: Event[] = dbEvents
                .filter((e) => e.contract_address) // Only show events with contract addresses
                .map((e) => ({
                    id: e.id,
                    contractAddress: e.contract_address as `0x${string}`,
                    chainId: e.chain_id,
                    name: e.name,
                    description: e.description || "",
                    date: e.date ? new Date(e.date) : new Date(),
                    venue: e.venue || "",
                    imageUrl: e.image_url || "",
                    ticketPrice: e.ticket_price ? BigInt(Math.floor(parseFloat(e.ticket_price) * 1e18)) : BigInt(0),
                    totalSupply: e.total_supply || 0,
                    soldCount: e.sold_count || 0,
                    organizer: e.organizer_address as `0x${string}`,
                    maxResalePrice: e.max_resale_price ? BigInt(Math.floor(parseFloat(e.max_resale_price) * 1e18)) : undefined,
                    city: e.city || undefined,
                    country: e.country || undefined,
                    distance_km: (e as Record<string, unknown>).distance_km as number | null | undefined,
                }));

            setEvents(transformedEvents);
        } catch (err) {
            console.error("Error fetching events:", err);
            setError({
                code: ErrorCode.CONTRACT_ERROR,
                message: "Failed to load events",
                details: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsLoading(false);
        }
    }, [status, organizer, lat, lon, radius, sortByDistance, city, state, country, date, chainId]);

    useEffect(() => {
        if (autoFetch) {
            fetchEvents();
        }
    }, [fetchEvents, autoFetch]);

    return {
        events,
        rawEvents,
        isLoading,
        error,
        refetch: fetchEvents,
    };
}
