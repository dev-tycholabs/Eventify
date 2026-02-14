"use client";

import { useState, useCallback, useEffect } from "react";
import type { Tables, TransactionType } from "@/lib/supabase/types";

type DBTransaction = Tables<"transactions"> & {
    events?: {
        id: string;
        name: string;
        date: string | null;
        venue: string | null;
        image_url: string | null;
    } | null;
};

export interface TicketHistoryEntry {
    id: string;
    txHash: string;
    txType: TransactionType;
    userAddress: `0x${string}`;
    amount: bigint | null;
    fromAddress: `0x${string}` | null;
    toAddress: `0x${string}` | null;
    listingId: string | null;
    txTimestamp: Date;
}

interface UseTicketHistoryOptions {
    tokenId: string;
    eventContractAddress: string;
    enabled?: boolean;
}

export function useTicketHistory(options: UseTicketHistoryOptions) {
    const { tokenId, eventContractAddress, enabled = true } = options;

    const [history, setHistory] = useState<TicketHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(async () => {
        if (!tokenId || !eventContractAddress) {
            setHistory([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.set("token_id", tokenId);
            params.set("event_contract", eventContractAddress);

            const response = await fetch(`/api/transactions?${params.toString()}`);

            if (!response.ok) {
                throw new Error("Failed to fetch ticket history");
            }

            const data = await response.json();
            const dbTransactions: DBTransaction[] = data.transactions || [];

            const transformedHistory: TicketHistoryEntry[] = dbTransactions.map((t) => ({
                id: t.id,
                txHash: t.tx_hash,
                txType: t.tx_type,
                userAddress: t.user_address as `0x${string}`,
                amount: t.amount ? BigInt(t.amount) : null,
                fromAddress: t.from_address as `0x${string}` | null,
                toAddress: t.to_address as `0x${string}` | null,
                listingId: t.listing_id,
                txTimestamp: new Date(t.tx_timestamp),
            }));

            setHistory(transformedHistory);
        } catch (err) {
            console.error("Error fetching ticket history:", err);
            setError(err instanceof Error ? err.message : "Failed to load ticket history");
        } finally {
            setIsLoading(false);
        }
    }, [tokenId, eventContractAddress]);

    useEffect(() => {
        if (enabled) {
            fetchHistory();
        }
    }, [fetchHistory, enabled]);

    return {
        history,
        isLoading,
        error,
        refetch: fetchHistory,
    };
}
