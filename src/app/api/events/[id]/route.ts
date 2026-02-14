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

        return NextResponse.json({
            event: data,
            royaltyRecipients: royaltyRecipients || []
        });
    } catch (error) {
        console.error("Error fetching event:", error);
        return NextResponse.json(
            { error: "Failed to fetch event" },
            { status: 500 }
        );
    }
}
