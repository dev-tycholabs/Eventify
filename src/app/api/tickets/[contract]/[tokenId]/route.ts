import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

type TicketWithEvent = Tables<"user_tickets"> & {
    events: {
        id: string;
        name: string;
        date: string | null;
        venue: string | null;
        image_url: string | null;
        ticket_price: string | null;
        contract_address: string | null;
        max_resale_price: string | null;
        organizer_address: string;
        description: string | null;
    } | null;
};

// GET /api/tickets/[contract]/[tokenId] - Get a single ticket by contract and tokenId
// Optional query param: ?chain_id=... (needed when same contract exists on multiple chains)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ contract: string; tokenId: string }> }
) {
    try {
        const { contract, tokenId } = await params;
        const { searchParams } = new URL(request.url);
        const chainId = searchParams.get("chain_id") ? parseInt(searchParams.get("chain_id")!) : null;

        if (!contract || !tokenId) {
            return NextResponse.json(
                { error: "Contract address and token ID are required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

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
                    max_resale_price,
                    organizer_address,
                    description
                )
            `)
            .eq("event_contract_address", contract.toLowerCase())
            .eq("token_id", tokenId);

        if (chainId) {
            query = query.eq("chain_id", chainId);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Ticket not found" },
                    { status: 404 }
                );
            }
            throw error;
        }

        const ticket = data as TicketWithEvent;

        // If ticket is listed, fetch listing info
        let listing = null;
        if (ticket.is_listed && ticket.listing_id) {
            const { data: listingData } = await supabase
                .from("marketplace_listings")
                .select("listing_id, price, status, seller_address")
                .eq("listing_id", ticket.listing_id)
                .single();
            listing = listingData;
        }

        return NextResponse.json({
            ticket: {
                ...ticket,
                marketplace_listing: listing
            }
        });
    } catch (error) {
        console.error("Error fetching ticket:", error);
        return NextResponse.json(
            { error: "Failed to fetch ticket" },
            { status: 500 }
        );
    }
}
