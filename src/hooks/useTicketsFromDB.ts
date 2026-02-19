"use client";

import { useState, useCallback, useEffect } from "react";
import type { Tables } from "@/lib/supabase/types";
import { ErrorCode, type AppError } from "@/types/errors";

type DBTicket = Tables<"user_tickets"> & {
    events?: {
        id: string;
        name: string;
        date: string | null;
        venue: string | null;
        image_url: string | null;
        ticket_price: string | null;
        contract_address: string | null;
        max_resale_price: string | null;
    } | null;
    marketplace_listings?: {
        listing_id: string;
        price: string;
        status: string;
    } | null;
};

export interface UserTicketFromDB {
    id: string;
    tokenId: bigint;
    eventContractAddress: `0x${string}`;
    chainId: number;
    eventId: string | null;
    ownerAddress: `0x${string}`;
    isUsed: boolean;
    isListed: boolean;
    listingId: string | null;
    listingPrice: bigint | null;
    purchasePrice: bigint | null;
    purchaseTxHash: string | null;
    purchasedAt: Date;
    usedAt: Date | null;
    // Event info from join
    eventName?: string;
    eventDate?: Date;
    eventVenue?: string;
    eventImageUrl?: string;
    ticketPrice?: bigint;
    maxResalePrice?: bigint;
}

interface UseTicketsFromDBOptions {
    owner: string;
    eventContract?: string;
    isListed?: boolean | null; // true = listed only, false = unlisted only, null/undefined = all
    autoFetch?: boolean;
    chainId?: number | null;
}

export function useTicketsFromDB(options: UseTicketsFromDBOptions) {
    const { owner, eventContract, isListed, autoFetch = true, chainId } = options;

    const [tickets, setTickets] = useState<UserTicketFromDB[]>([]);
    const [rawTickets, setRawTickets] = useState<DBTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<AppError | null>(null);

    const fetchTickets = useCallback(async () => {
        if (!owner) {
            setTickets([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.set("owner", owner);
            if (eventContract) params.set("event_contract", eventContract);
            if (isListed !== null && isListed !== undefined) {
                params.set("is_listed", isListed.toString());
            }
            if (chainId) params.set("chain_id", String(chainId));

            const response = await fetch(`/api/tickets?${params.toString()}`);

            if (!response.ok) {
                throw new Error("Failed to fetch tickets");
            }

            const data = await response.json();
            const dbTickets: DBTicket[] = data.tickets || [];

            setRawTickets(dbTickets);

            // Transform DB tickets
            const transformedTickets: UserTicketFromDB[] = dbTickets.map((t) => ({
                id: t.id,
                tokenId: BigInt(t.token_id),
                eventContractAddress: t.event_contract_address as `0x${string}`,
                chainId: t.chain_id,
                eventId: t.event_id,
                ownerAddress: t.owner_address as `0x${string}`,
                isUsed: t.is_used,
                isListed: t.is_listed,
                listingId: t.listing_id,
                listingPrice: t.marketplace_listings?.price
                    ? BigInt(t.marketplace_listings.price)
                    : null,
                purchasePrice: t.purchase_price ? BigInt(t.purchase_price) : null,
                purchaseTxHash: t.purchase_tx_hash,
                purchasedAt: new Date(t.purchased_at),
                usedAt: t.used_at ? new Date(t.used_at) : null,
                // Event info from join
                eventName: t.events?.name,
                eventDate: t.events?.date ? new Date(t.events.date) : undefined,
                eventVenue: t.events?.venue || undefined,
                eventImageUrl: t.events?.image_url || undefined,
                ticketPrice: t.events?.ticket_price
                    ? BigInt(Math.floor(parseFloat(t.events.ticket_price) * 1e18))
                    : undefined,
                maxResalePrice: t.events?.max_resale_price
                    ? BigInt(Math.floor(parseFloat(t.events.max_resale_price) * 1e18))
                    : undefined,
            }));

            setTickets(transformedTickets);
        } catch (err) {
            console.error("Error fetching tickets:", err);
            setError({
                code: ErrorCode.CONTRACT_ERROR,
                message: "Failed to load tickets",
                details: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsLoading(false);
        }
    }, [owner, eventContract, isListed, chainId]);

    useEffect(() => {
        if (autoFetch) {
            fetchTickets();
        }
    }, [fetchTickets, autoFetch]);

    return {
        tickets,
        rawTickets,
        isLoading,
        error,
        refetch: fetchTickets,
    };
}
