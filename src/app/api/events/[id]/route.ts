import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/events/[id] - Get single event by ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: "Event ID is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        const { data, error } = await supabase
            .from("events")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                return NextResponse.json(
                    { error: "Event not found" },
                    { status: 404 }
                );
            }
            throw error;
        }

        // Fetch royalty recipients for this event
        const { data: royaltyRecipients, error: royaltyError } = await supabase
            .from("royalty_recipients")
            .select("*")
            .eq("event_id", id)
            .order("percentage", { ascending: false });

        if (royaltyError) {
            console.error("Error fetching royalty recipients:", royaltyError);
        }

        // Fetch marketplace listings (resales) for this event
        const { data: resaleListings, error: resaleError } = await supabase
            .from("marketplace_listings")
            .select("id, listing_id, token_id, seller_address, buyer_address, price, status, listed_at, sold_at, cancelled_at")
            .eq("event_id", id)
            .order("listed_at", { ascending: false });

        if (resaleError) {
            console.error("Error fetching resale listings:", resaleError);
        }

        return NextResponse.json({
            event: data,
            royaltyRecipients: royaltyRecipients || [],
            resaleListings: resaleListings || [],
        });
    } catch (error) {
        console.error("Error fetching event:", error);
        return NextResponse.json(
            { error: "Failed to fetch event" },
            { status: 500 }
        );
    }
}
