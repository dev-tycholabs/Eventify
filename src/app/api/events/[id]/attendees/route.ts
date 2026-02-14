import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/events/[id]/attendees - Get attendees grouped by owner
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

        // Verify event exists
        const { data: event, error: eventError } = await supabase
            .from("events")
            .select("id, contract_address")
            .eq("id", id)
            .single();

        if (eventError || !event) {
            return NextResponse.json(
                { error: "Event not found" },
                { status: 404 }
            );
        }

        // Fetch all tickets for this event
        const { data: tickets, error: ticketsError } = await supabase
            .from("user_tickets")
            .select("token_id, owner_address, is_used, is_listed, purchased_at")
            .eq("event_id", id)
            .order("purchased_at", { ascending: true });

        if (ticketsError) {
            throw ticketsError;
        }

        if (!tickets || tickets.length === 0) {
            return NextResponse.json({ attendees: [], totalTickets: 0, totalAttendees: 0 });
        }

        // Get unique owner addresses
        const ownerAddresses = [...new Set(tickets.map((t) => t.owner_address))];

        // Fetch user profiles for all owners
        const { data: users } = await supabase
            .from("users")
            .select("wallet_address, username, name, avatar_url")
            .in("wallet_address", ownerAddresses);

        const userMap = new Map(
            (users || []).map((u) => [u.wallet_address.toLowerCase(), u])
        );

        // Group tickets by owner
        const attendeeMap = new Map<
            string,
            {
                ownerAddress: string;
                username: string | null;
                name: string | null;
                avatarUrl: string | null;
                tickets: { tokenId: string; isUsed: boolean; isListed: boolean; purchasedAt: string | null }[];
            }
        >();

        for (const ticket of tickets) {
            const addr = ticket.owner_address.toLowerCase();
            if (!attendeeMap.has(addr)) {
                const user = userMap.get(addr);
                attendeeMap.set(addr, {
                    ownerAddress: ticket.owner_address,
                    username: user?.username || null,
                    name: user?.name || null,
                    avatarUrl: user?.avatar_url || null,
                    tickets: [],
                });
            }
            attendeeMap.get(addr)!.tickets.push({
                tokenId: ticket.token_id,
                isUsed: ticket.is_used,
                isListed: ticket.is_listed,
                purchasedAt: ticket.purchased_at,
            });
        }

        // Sort attendees by ticket count descending
        const attendees = Array.from(attendeeMap.values()).sort(
            (a, b) => b.tickets.length - a.tickets.length
        );

        return NextResponse.json({
            attendees,
            totalTickets: tickets.length,
            totalAttendees: attendees.length,
        });
    } catch (error) {
        console.error("Error fetching attendees:", error);
        return NextResponse.json(
            { error: "Failed to fetch attendees" },
            { status: 500 }
        );
    }
}
