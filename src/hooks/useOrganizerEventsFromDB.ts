"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { config } from "@/config/wagmi-client";
import type { Tables } from "@/lib/supabase/types";

type Event = Tables<"events">;

export interface OrganizerEventFromDB {
    id: string;
    contractAddress: `0x${string}`;
    chainId: number;
    name: string;
    venue: string;
    date: Date;
    ticketPrice: bigint;
    maxSupply: number;
    soldCount: number;
    remainingTickets: number;
    contractBalance: bigint;
    // DB fields
    description: string | null;
    imageUrl: string | null;
    eventType: string;
}

export function useOrganizerEventsFromDB() {
    const [isLoading, setIsLoading] = useState(false);
    const [organizerEvents, setOrganizerEvents] = useState<OrganizerEventFromDB[]>([]);
    const { address, isConnected } = useAccount();

    const fetchOrganizerEvents = useCallback(async () => {
        if (!address) {
            setOrganizerEvents([]);
            return;
        }

        setIsLoading(true);
        try {
            // Fetch published events from Supabase API
            const response = await fetch(
                `/api/events?organizer=${address}&status=published`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch events");
            }

            const { events } = await response.json() as { events: Event[] };

            if (!events || events.length === 0) {
                setOrganizerEvents([]);
                return;
            }

            // Only fetch balance from blockchain for each event
            const eventsWithBalance: OrganizerEventFromDB[] = await Promise.all(
                events
                    .filter((event) => event.contract_address) // Only events with contract
                    .map(async (event) => {
                        const contractAddress = event.contract_address as `0x${string}`;
                        const eventChainId = event.chain_id as number;

                        // Get public client for the specific blockchain
                        let balance = BigInt(0);
                        try {
                            const chainPublicClient = getPublicClient(config, { chainId: eventChainId });
                            if (chainPublicClient) {
                                balance = await chainPublicClient.getBalance({ address: contractAddress });
                            }
                        } catch (err) {
                            console.error(`Failed to fetch balance for ${contractAddress} on chain ${eventChainId}:`, err);
                        }

                        const totalSupply = event.total_supply || 0;
                        const soldCount = event.sold_count || 0;

                        return {
                            id: event.id,
                            contractAddress,
                            chainId: eventChainId,
                            name: event.name,
                            venue: event.venue || "",
                            date: event.date ? new Date(event.date) : new Date(),
                            ticketPrice: BigInt(Math.floor(parseFloat(event.ticket_price || "0") * 1e18)),
                            maxSupply: totalSupply,
                            soldCount: soldCount,
                            remainingTickets: totalSupply - soldCount,
                            contractBalance: balance,
                            description: event.description,
                            imageUrl: event.image_url,
                            eventType: event.event_type,
                        };
                    })
            );

            setOrganizerEvents(eventsWithBalance);
        } catch (err) {
            console.error("Failed to fetch organizer events:", err);
            setOrganizerEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    useEffect(() => {
        if (isConnected && address) {
            fetchOrganizerEvents();
        }
    }, [isConnected, address, fetchOrganizerEvents]);

    const refetch = useCallback(async () => {
        await fetchOrganizerEvents();
    }, [fetchOrganizerEvents]);

    return {
        organizerEvents,
        isLoading,
        refetch,
    };
}
