"use client";

import { useState, useCallback, useEffect } from "react";
import type { Tables, TransactionType } from "@/lib/supabase/types";
import { ErrorCode, type AppError } from "@/types/errors";

type DBTransaction = Tables<"transactions"> & {
    events?: {
        id: string;
        name: string;
        date: string | null;
        venue: string | null;
        image_url: string | null;
    } | null;
};

export interface TransactionFromDB {
    id: string;
    txHash: string;
    txType: TransactionType;
    userAddress: `0x${string}`;
    tokenId: string | null;
    eventContractAddress: `0x${string}` | null;
    eventId: string | null;
    listingId: string | null;
    amount: bigint | null;
    fromAddress: `0x${string}` | null;
    toAddress: `0x${string}` | null;
    blockNumber: string | null;
    txTimestamp: Date;
    createdAt: Date;
    // Event info from join
    eventName?: string;
    eventDate?: Date;
    eventVenue?: string;
    eventImageUrl?: string;
}

interface UseTransactionsFromDBOptions {
    user: string;
    txType?: TransactionType;
    eventContract?: string;
    autoFetch?: boolean;
}

export function useTransactionsFromDB(options: UseTransactionsFromDBOptions) {
    const { user, txType, eventContract, autoFetch = true } = options;

    const [transactions, setTransactions] = useState<TransactionFromDB[]>([]);
    const [rawTransactions, setRawTransactions] = useState<DBTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<AppError | null>(null);

    const fetchTransactions = useCallback(async () => {
        if (!user) {
            setTransactions([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.set("user", user);
            if (txType) params.set("type", txType);
            if (eventContract) params.set("event_contract", eventContract);

            const response = await fetch(`/api/transactions?${params.toString()}`);

            if (!response.ok) {
                throw new Error("Failed to fetch transactions");
            }

            const data = await response.json();
            const dbTransactions: DBTransaction[] = data.transactions || [];

            setRawTransactions(dbTransactions);

            // Transform DB transactions
            const transformedTransactions: TransactionFromDB[] = dbTransactions.map((t) => ({
                id: t.id,
                txHash: t.tx_hash,
                txType: t.tx_type,
                userAddress: t.user_address as `0x${string}`,
                tokenId: t.token_id,
                eventContractAddress: t.event_contract_address as `0x${string}` | null,
                eventId: t.event_id,
                listingId: t.listing_id,
                amount: t.amount ? BigInt(t.amount) : null,
                fromAddress: t.from_address as `0x${string}` | null,
                toAddress: t.to_address as `0x${string}` | null,
                blockNumber: t.block_number,
                txTimestamp: new Date(t.tx_timestamp),
                createdAt: new Date(t.created_at),
                // Event info from join
                eventName: t.events?.name,
                eventDate: t.events?.date ? new Date(t.events.date) : undefined,
                eventVenue: t.events?.venue || undefined,
                eventImageUrl: t.events?.image_url || undefined,
            }));

            setTransactions(transformedTransactions);
        } catch (err) {
            console.error("Error fetching transactions:", err);
            setError({
                code: ErrorCode.CONTRACT_ERROR,
                message: "Failed to load transaction history",
                details: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, txType, eventContract]);

    useEffect(() => {
        if (autoFetch) {
            fetchTransactions();
        }
    }, [fetchTransactions, autoFetch]);

    return {
        transactions,
        rawTransactions,
        isLoading,
        error,
        refetch: fetchTransactions,
    };
}
