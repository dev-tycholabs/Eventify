import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { InsertTables, UpdateTables, Tables } from "@/lib/supabase/types";

type UserTicket = Tables<"user_tickets">;
type TicketWithEvent = UserTicket & {
    events: {
        id: string;
        name: string;
        date: string | null;
        venue: string | null;
        image_url: string | null;
        ticket_price: string | null;
        contract_address: string | null;
        max_resale_price: string | null;
    } | null;
};

// GET /api/tickets - Get user's tickets
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const owner = searchParams.get("owner");
        const eventContract = searchParams.get("event_contract");
        const isListed = searchParams.get("is_listed"); // "true", "false", or null for all
        const limit = parseInt(searchParams.get("limit") || "100");
        const offset = parseInt(searchParams.get("offset") || "0");

        if (!owner) {
            return NextResponse.json(
                { error: "Owner address is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // First, fetch tickets with event data
        let query = supabase
            .from("user_tickets")
            .select(`
                *,
                events:event_id (
                    id,
                    name,
                    date,
                    venue,
                    image_url,
                    ticket_price,
                    contract_address,
                    max_resale_price
                )
            `)
            .eq("owner_address", owner.toLowerCase())
            .order("purchased_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (eventContract) {
            query = query.eq("event_contract_address", eventContract.toLowerCase());
        }

        // Filter by listing status
        if (isListed === "true") {
            query = query.eq("is_listed", true);
        } else if (isListed === "false") {
            query = query.eq("is_listed", false);
        }

        const { data: tickets, error } = await query;

        if (error) throw error;

        const typedTickets = (tickets || []) as TicketWithEvent[];

        // For listed tickets, fetch their listing prices
        const listedTicketIds = typedTickets
            .filter(t => t.is_listed && t.listing_id)
            .map(t => t.listing_id as string);

        let listingsMap: Record<string, { price: string; status: string }> = {};

        if (listedTicketIds.length > 0) {
            const { data: listings } = await supabase
                .from("marketplace_listings")
                .select("listing_id, price, status")
                .in("listing_id", listedTicketIds);

            if (listings) {
                listingsMap = listings.reduce((acc, l) => {
                    acc[l.listing_id] = { price: l.price, status: l.status };
                    return acc;
                }, {} as Record<string, { price: string; status: string }>);
            }
        }

        // Merge listing data into tickets
        const ticketsWithListings = typedTickets.map(t => ({
            ...t,
            marketplace_listings: t.listing_id ? listingsMap[t.listing_id] || null : null,
        }));

        return NextResponse.json({ tickets: ticketsWithListings });
    } catch (error) {
        console.error("Error fetching tickets:", error);
        return NextResponse.json(
            { error: "Failed to fetch tickets" },
            { status: 500 }
        );
    }
}

// POST /api/tickets - Create or update a ticket
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            token_id,
            event_contract_address,
            event_id,
            owner_address,
            is_used,
            is_listed,
            listing_id,
            purchase_price,
            purchase_tx_hash,
            action, // "mint", "transfer", "use", "list", "unlist"
        } = body;

        if (!token_id || !event_contract_address || !owner_address) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        if (action === "mint" || action === "transfer") {
            // Create or update ticket ownership
            const insertData: InsertTables<"user_tickets"> = {
                token_id: token_id.toString(),
                event_contract_address: event_contract_address.toLowerCase(),
                event_id: event_id || null,
                owner_address: owner_address.toLowerCase(),
                is_used: is_used || false,
                is_listed: is_listed || false,
                listing_id: listing_id || null,
                purchase_price: purchase_price?.toString() || null,
                purchase_tx_hash: purchase_tx_hash || null,
            };

            const { data, error } = await supabase
                .from("user_tickets")
                .upsert(insertData, {
                    onConflict: "event_contract_address,token_id",
                })
                .select()
                .single();

            if (error) throw error;

            // Increment sold_count on events table for new mints only
            if (action === "mint" && event_id) {
                // Fetch current sold_count and increment
                const { data: eventData, error: fetchError } = await supabase
                    .from("events")
                    .select("sold_count")
                    .eq("id", event_id)
                    .single();

                if (!fetchError && eventData) {
                    const newSoldCount = (eventData.sold_count || 0) + 1;
                    const { error: updateError } = await supabase
                        .from("events")
                        .update({ sold_count: newSoldCount })
                        .eq("id", event_id);

                    if (updateError) {
                        console.error("Failed to increment sold_count:", updateError);
                    }
                } else if (fetchError) {
                    console.error("Failed to fetch event for sold_count update:", fetchError);
                }
            }

            return NextResponse.json({ ticket: data });
        }

        if (action === "use") {
            // Mark ticket as used
            const updateData: UpdateTables<"user_tickets"> = {
                is_used: true,
                used_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from("user_tickets")
                .update(updateData)
                .eq("event_contract_address", event_contract_address.toLowerCase())
                .eq("token_id", token_id.toString())
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ ticket: data });
        }

        if (action === "list") {
            // Mark ticket as listed
            const updateData: UpdateTables<"user_tickets"> = {
                is_listed: true,
                listing_id: listing_id?.toString() || null,
            };

            const { data, error } = await supabase
                .from("user_tickets")
                .update(updateData)
                .eq("event_contract_address", event_contract_address.toLowerCase())
                .eq("token_id", token_id.toString())
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ ticket: data });
        }

        if (action === "unlist") {
            // Mark ticket as not listed
            const updateData: UpdateTables<"user_tickets"> = {
                is_listed: false,
                listing_id: null,
            };

            const { data, error } = await supabase
                .from("user_tickets")
                .update(updateData)
                .eq("event_contract_address", event_contract_address.toLowerCase())
                .eq("token_id", token_id.toString())
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ ticket: data });
        }

        return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 }
        );
    } catch (error) {
        console.error("Error updating ticket:", error);
        return NextResponse.json(
            { error: "Failed to update ticket" },
            { status: 500 }
        );
    }
}
