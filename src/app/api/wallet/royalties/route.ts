import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get("address");

        if (!address) {
            return NextResponse.json(
                { error: "Address is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Fetch royalty_recipients rows where this address is a recipient, join with events
        const { data, error } = await supabase
            .from("royalty_recipients")
            .select(`
                id,
                percentage,
                royalty_earned,
                royalty_claimed,
                recipient_name,
                event_id,
                events (
                    id,
                    name,
                    date,
                    image_url,
                    venue,
                    city,
                    contract_address,
                    chain_id,
                    royalty_percent,
                    royalty_splitter_address,
                    organizer_address,
                    status
                )
            `)
            .eq("recipient_address", address.toLowerCase())
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching royalty events:", error);
            return NextResponse.json(
                { error: "Failed to fetch royalty events" },
                { status: 500 }
            );
        }

        return NextResponse.json({ royalties: data || [] });
    } catch (err) {
        console.error("Royalties API error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
