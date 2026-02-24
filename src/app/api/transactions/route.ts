import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { TransactionType, InsertTables } from "@/lib/supabase/types";

// GET /api/transactions - Get user's transaction history or ticket history
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const user = searchParams.get("user");
        const tokenId = searchParams.get("token_id");
        const txType = searchParams.get("type") as TransactionType | null;
        const eventContract = searchParams.get("event_contract");
        const chainId = searchParams.get("chain_id") ? parseInt(searchParams.get("chain_id")!) : null;
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");

        // Either user or (token_id + event_contract) is required
        if (!user && !(tokenId && eventContract)) {
            return NextResponse.json(
                { error: "Either user address or (token_id + event_contract) is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        let query = supabase
            .from("transactions")
            .select(`
                *,
                events:event_id (
                    id,
                    name,
                    date,
                    venue,
                    image_url
                )
            `)
            .order("tx_timestamp", { ascending: false })
            .range(offset, offset + limit - 1);

        // If fetching ticket history (by token_id + event_contract)
        if (tokenId && eventContract) {
            query = query
                .eq("token_id", tokenId)
                .eq("event_contract_address", eventContract.toLowerCase());
        } else if (user) {
            // Fetching user's transaction history
            query = query.eq("user_address", user.toLowerCase());

            if (eventContract) {
                query = query.eq("event_contract_address", eventContract.toLowerCase());
            }
        }

        if (txType) {
            query = query.eq("tx_type", txType);
        }

        if (chainId) {
            query = query.eq("chain_id", chainId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Get total count with same filters
        const countQuery = supabase
            .from("transactions")
            .select("id", { count: "exact", head: true });

        if (tokenId && eventContract) {
            countQuery.eq("token_id", tokenId).eq("event_contract_address", eventContract.toLowerCase());
        } else if (user) {
            countQuery.eq("user_address", user.toLowerCase());
            if (eventContract) countQuery.eq("event_contract_address", eventContract.toLowerCase());
        }
        if (txType) countQuery.eq("tx_type", txType);
        if (chainId) countQuery.eq("chain_id", chainId);

        const { count: totalCount } = await countQuery;

        return NextResponse.json({ transactions: data, totalCount: totalCount ?? 0 });
    } catch (error) {
        console.error("Error fetching transactions:", error);
        return NextResponse.json(
            { error: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

// POST /api/transactions - Record a transaction
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            tx_hash,
            tx_type,
            user_address,
            token_id,
            event_contract_address,
            event_id,
            listing_id,
            amount,
            from_address,
            to_address,
            block_number,
            tx_timestamp,
            chain_id,
        } = body;

        if (!tx_hash || !tx_type || !user_address || !tx_timestamp || !chain_id) {
            return NextResponse.json(
                { error: "Missing required fields (tx_hash, tx_type, user_address, tx_timestamp, chain_id)" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        const insertData: InsertTables<"transactions"> = {
            chain_id: chain_id as number,
            tx_hash,
            tx_type: tx_type as TransactionType,
            user_address: user_address.toLowerCase(),
            token_id: token_id?.toString() || null,
            event_contract_address: event_contract_address?.toLowerCase() || null,
            event_id: event_id || null,
            listing_id: listing_id?.toString() || null,
            amount: amount?.toString() || null,
            from_address: from_address?.toLowerCase() || null,
            to_address: to_address?.toLowerCase() || null,
            block_number: block_number?.toString() || null,
            tx_timestamp,
        };

        const { data, error } = await supabase
            .from("transactions")
            .upsert(insertData, {
                onConflict: "chain_id,tx_hash,tx_type,user_address",
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ transaction: data });
    } catch (error) {
        console.error("Error recording transaction:", error);
        return NextResponse.json(
            { error: "Failed to record transaction" },
            { status: 500 }
        );
    }
}
