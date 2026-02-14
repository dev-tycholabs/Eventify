import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/chat/events?user_address=0x...
// Returns events where the user holds tickets or is the organizer
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get("user_address");

        if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
            return NextResponse.json(
                { error: "Valid user_address is required" },
                { status: 400 }
            );
        }

        const addr = userAddress.toLowerCase();
        const supabase = createServerClient();

        // 1. Events where user is organizer
        const { data: organizedEvents } = await supabase
            .from("events")
            .select("id, name, image_url, organizer_address, contract_address, date")
            .eq("organizer_address", addr)
            .eq("status", "published")
            .not("contract_address", "is", null);

        // 2. Events where user holds tickets
        const { data: tickets } = await supabase
            .from("user_tickets")
            .select("event_id, event_contract_address")
            .eq("owner_address", addr);

        const ticketEventIds = [...new Set((tickets || []).map((t) => t.event_id).filter(Boolean))] as string[];

        let ticketEvents: typeof organizedEvents = [];
        if (ticketEventIds.length > 0) {
            const { data } = await supabase
                .from("events")
                .select("id, name, image_url, organizer_address, contract_address, date")
                .in("id", ticketEventIds)
                .eq("status", "published")
                .not("contract_address", "is", null);
            ticketEvents = data || [];
        }

        // Merge and deduplicate
        const allEvents = [...(organizedEvents || []), ...(ticketEvents || [])];
        const seen = new Set<string>();
        const unique = allEvents.filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
        });

        // For each event, get the last message for preview
        const eventsWithPreview = await Promise.all(
            unique.map(async (event) => {
                const { data: lastMsg } = await supabase
                    .from("chat_messages")
                    .select("content, created_at, user_address")
                    .eq("event_id", event.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                return {
                    ...event,
                    isOrganizer: event.organizer_address.toLowerCase() === addr,
                    lastMessage: lastMsg || null,
                };
            })
        );

        // Sort by last message time (most recent first), events with no messages go last
        eventsWithPreview.sort((a, b) => {
            const aTime = a.lastMessage?.created_at || a.date || "";
            const bTime = b.lastMessage?.created_at || b.date || "";
            return bTime.localeCompare(aTime);
        });

        return NextResponse.json({ events: eventsWithPreview });
    } catch (error) {
        console.error("Error fetching chat events:", error);
        return NextResponse.json(
            { error: "Failed to fetch chat events" },
            { status: 500 }
        );
    }
}
