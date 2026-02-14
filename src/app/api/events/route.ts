import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyWalletSignature } from "@/lib/auth/verify-wallet";
import type { EventStatus, EventType, UpdateTables, InsertTables, MediaFileJson, Tables } from "@/lib/supabase/types";

type EventWithRecipients = Tables<"events"> & {
    royalty_recipients: Tables<"royalty_recipients">[];
};

interface RoyaltyRecipientInput {
    id?: string;
    address: string;
    name: string;
    percentage: string;
}

// Haversine distance in km
function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// GET /api/events - List events
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const organizer = searchParams.get("organizer");
        const status = searchParams.get("status") as EventStatus | null;
        const contractAddress = searchParams.get("contract_address");
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");

        // Location-based params
        const lat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
        const lon = searchParams.get("lon") ? parseFloat(searchParams.get("lon")!) : null;
        const radius = searchParams.get("radius") ? parseFloat(searchParams.get("radius")!) : null;
        const sortByDistance = searchParams.get("sort") === "distance";

        // Text-based location filters
        const cityFilter = searchParams.get("city");
        const stateFilter = searchParams.get("state");
        const countryFilter = searchParams.get("country");

        // Date filters
        const dateFilter = searchParams.get("date"); // exact date: YYYY-MM-DD
        const monthFilter = searchParams.get("month"); // month: YYYY-MM (for fetching event dates in a month)
        const datesOnly = searchParams.get("dates_only") === "true"; // return only distinct dates

        const supabase = createServerClient();

        let query = supabase
            .from("events")
            .select("*, royalty_recipients(*)")
            .order("created_at", { ascending: false });

        if (organizer) {
            query = query.eq("organizer_address", organizer.toLowerCase());
        }

        if (status) {
            query = query.eq("status", status);
        }

        if (contractAddress) {
            query = query.eq("contract_address", contractAddress.toLowerCase());
        }

        if (cityFilter) {
            query = query.ilike("city", cityFilter);
        }

        if (stateFilter) {
            query = query.ilike("state", stateFilter);
        }

        if (countryFilter) {
            query = query.ilike("country", countryFilter);
        }

        if (dateFilter) {
            // Filter events on an exact date: date starts with YYYY-MM-DD
            query = query.gte("date", `${dateFilter}T00:00:00`).lt("date", `${dateFilter}T23:59:59.999`);
        } else if (monthFilter) {
            // Filter events within a month: YYYY-MM
            const [y, m] = monthFilter.split("-").map(Number);
            const startOfMonth = `${monthFilter}-01T00:00:00`;
            const nextMonth = m === 12 ? `${y + 1}-01-01T00:00:00` : `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00`;
            query = query.gte("date", startOfMonth).lt("date", nextMonth);
        }

        // If only dates requested, return distinct event dates for the calendar
        if (datesOnly) {
            const { data, error } = await query.select("date").not("date", "is", null);
            if (error) throw error;
            const dates = [...new Set(
                (data || [])
                    .map((e: { date: string | null }) => e.date ? e.date.split("T")[0] : null)
                    .filter(Boolean)
            )];
            return NextResponse.json({ dates });
        }

        // If nearby/distance sorting requested, fetch all and compute distances
        if (lat !== null && lon !== null && (radius || sortByDistance)) {
            const { data, error } = await query;
            if (error) throw error;
            const events = (data || []) as EventWithRecipients[];

            // Build unique (city, state, country) triples from events
            const locationPairs = new Map<
                string,
                { city: string; state: string | null; country: string | null }
            >();
            for (const e of events) {
                if (e.city) {
                    const key = `${e.city}||${e.state || ""}||${e.country || ""}`;
                    if (!locationPairs.has(key)) {
                        locationPairs.set(key, { city: e.city, state: e.state, country: e.country });
                    }
                }
            }

            // Lookup coordinates for each unique (city, state, country) triple
            const cityCoords: Record<string, { lat: number; lon: number }> = {};

            if (locationPairs.size > 0) {
                const cityNames = [...new Set([...locationPairs.values()].map((p) => p.city))];

                // Fetch all candidate cities by name, including country_id
                const { data: cities } = await supabase
                    .from("cities")
                    .select("name, state_id, country_id, latitude, longitude")
                    .in("name", cityNames);

                if (cities && cities.length > 0) {
                    // Resolve state names
                    const stateIds = [...new Set(cities.map((c) => c.state_id))];
                    const { data: states } = await supabase
                        .from("states")
                        .select("id, name")
                        .in("id", stateIds);

                    const stateNameById: Record<number, string> = {};
                    if (states) {
                        for (const s of states) {
                            stateNameById[s.id] = s.name;
                        }
                    }

                    // Resolve country names
                    const countryIds = [...new Set(cities.map((c) => c.country_id))];
                    const { data: countries } = await supabase
                        .from("countries")
                        .select("id, name")
                        .in("id", countryIds);

                    const countryNameById: Record<number, string> = {};
                    if (countries) {
                        for (const co of countries) {
                            countryNameById[co.id] = co.name;
                        }
                    }

                    // Match cities using full (city, state, country) key
                    for (const c of cities) {
                        const stateName = stateNameById[c.state_id] || "";
                        const countryName = countryNameById[c.country_id] || "";
                        const key = `${c.name}||${stateName}||${countryName}`;
                        if (!cityCoords[key]) {
                            cityCoords[key] = { lat: Number(c.latitude), lon: Number(c.longitude) };
                        }
                    }
                }
            }

            // Calculate distance for each event
            let eventsWithDistance = events.map((e) => {
                const key = `${e.city || ""}||${e.state || ""}||${e.country || ""}`;
                const coords = e.city ? cityCoords[key] : null;
                const distance_km = coords
                    ? haversineDistance(lat, lon, coords.lat, coords.lon)
                    : null;
                return { ...e, distance_km };
            });

            // Filter by radius
            if (radius) {
                eventsWithDistance = eventsWithDistance.filter(
                    (e) => e.distance_km !== null && e.distance_km <= radius
                );
            }

            // Sort by distance (events without coordinates go to the end)
            if (sortByDistance) {
                eventsWithDistance.sort((a, b) => {
                    if (a.distance_km === null) return 1;
                    if (b.distance_km === null) return -1;
                    return a.distance_km - b.distance_km;
                });
            }

            // Paginate
            const paginated = eventsWithDistance.slice(offset, offset + limit);

            return NextResponse.json({ events: paginated });
        }

        // Standard pagination (no location)
        query = query.range(offset, offset + limit - 1);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ events: data });
    } catch (error) {
        console.error("Error fetching events:", error);
        return NextResponse.json(
            { error: "Failed to fetch events" },
            { status: 500 }
        );
    }
}

// POST /api/events - Create or update an event
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            address,
            signature,
            message,
            event_id, // If provided, update existing event
            contract_address,
            name,
            symbol,
            description,
            date,
            timezone,
            event_type,
            venue,
            country,
            state,
            city,
            image_url,
            cover_image_url,
            media_files,
            ticket_price,
            total_supply,
            max_tickets_per_wallet,
            max_resale_price,
            royalty_percent,
            royalty_recipients,
            royalty_splitter_address,
            status = "draft",
        } = body;

        // Validate required fields
        if (!address || !signature || !message || !name) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Verify wallet ownership
        const isValid = await verifyWalletSignature({
            address,
            message,
            signature,
        });

        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            );
        }

        const supabase = createServerClient();

        // Update existing event
        if (event_id) {
            const updateData: UpdateTables<"events"> = {
                contract_address: contract_address?.toLowerCase() as string | null,
                name: name as string,
                symbol: symbol as string | null,
                description: description as string | null,
                date: date as string | null,
                timezone: timezone as string,
                event_type: event_type as EventType,
                venue: venue as string | null,
                country: country as string | null,
                state: state as string | null,
                city: city as string | null,
                image_url: image_url as string | null,
                cover_image_url: cover_image_url as string | null,
                media_files: media_files as MediaFileJson[] | undefined,
                ticket_price: ticket_price as string | null,
                total_supply: total_supply as number | null,
                max_tickets_per_wallet: max_tickets_per_wallet as number,
                max_resale_price: max_resale_price as string | null,
                royalty_percent: royalty_percent as string | null,
                royalty_splitter_address: royalty_splitter_address?.toLowerCase() as string | null,
                status: status as EventStatus,
            };

            const { data, error } = await supabase
                .from("events")
                .update(updateData)
                .eq("id", event_id)
                .eq("organizer_address", address.toLowerCase())
                .select()
                .single();

            if (error) throw error;

            // Handle royalty recipients update
            if (royalty_recipients !== undefined) {
                // Delete existing recipients
                await supabase
                    .from("royalty_recipients")
                    .delete()
                    .eq("event_id", event_id);

                // Insert new recipients if any
                if (royalty_recipients && royalty_recipients.length > 0) {
                    const recipientsToInsert = (royalty_recipients as RoyaltyRecipientInput[]).map((r) => ({
                        event_id: event_id,
                        recipient_address: r.address.toLowerCase(),
                        recipient_name: r.name || null,
                        percentage: parseFloat(r.percentage),
                    }));

                    const { error: recipientError } = await supabase
                        .from("royalty_recipients")
                        .insert(recipientsToInsert);

                    if (recipientError) {
                        console.error("Error inserting royalty recipients:", recipientError);
                    }
                }
            }

            // Fetch updated event with recipients
            const { data: eventWithRecipients } = await supabase
                .from("events")
                .select("*, royalty_recipients(*)")
                .eq("id", event_id)
                .single();

            return NextResponse.json({ event: eventWithRecipients || data });
        }

        // Create new event
        const insertData: InsertTables<"events"> = {
            contract_address: contract_address?.toLowerCase() as string | null,
            organizer_address: (address as string).toLowerCase(),
            name: name as string,
            symbol: symbol as string | null,
            description: description as string | null,
            date: date as string | null,
            timezone: timezone as string,
            event_type: event_type as EventType,
            venue: venue as string | null,
            country: country as string | null,
            state: state as string | null,
            city: city as string | null,
            image_url: image_url as string | null,
            cover_image_url: cover_image_url as string | null,
            media_files: media_files as MediaFileJson[] | undefined,
            ticket_price: ticket_price as string | null,
            total_supply: total_supply as number | null,
            max_tickets_per_wallet: max_tickets_per_wallet as number,
            max_resale_price: max_resale_price as string | null,
            royalty_percent: royalty_percent as string | null,
            royalty_splitter_address: royalty_splitter_address?.toLowerCase() as string | null,
            status: status as EventStatus,
        };

        const { data, error } = await supabase
            .from("events")
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;

        // Insert royalty recipients if any
        if (royalty_recipients && royalty_recipients.length > 0 && data) {
            const eventId = (data as { id: string }).id;
            const recipientsToInsert = (royalty_recipients as RoyaltyRecipientInput[]).map((r) => ({
                event_id: eventId,
                recipient_address: r.address.toLowerCase(),
                recipient_name: r.name || null,
                percentage: parseFloat(r.percentage),
            }));

            const { error: recipientError } = await supabase
                .from("royalty_recipients")
                .insert(recipientsToInsert);

            if (recipientError) {
                console.error("Error inserting royalty recipients:", recipientError);
            }

            // Fetch event with recipients
            const { data: eventWithRecipients } = await supabase
                .from("events")
                .select("*, royalty_recipients(*)")
                .eq("id", eventId)
                .single();

            return NextResponse.json({ event: eventWithRecipients || data });
        }

        return NextResponse.json({ event: data });
    } catch (error) {
        console.error("Error creating/updating event:", error);
        return NextResponse.json(
            { error: "Failed to save event" },
            { status: 500 }
        );
    }
}

// DELETE /api/events?id=...&address=...&signature=...&message=...
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const address = searchParams.get("address");
        const signature = searchParams.get("signature") as `0x${string}`;
        const message = searchParams.get("message");

        if (!id || !address || !signature || !message) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const isValid = await verifyWalletSignature({
            address,
            message,
            signature,
        });

        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            );
        }

        const supabase = createServerClient();

        // Only allow deleting drafts
        const { error } = await supabase
            .from("events")
            .delete()
            .eq("id", id)
            .eq("organizer_address", address.toLowerCase())
            .eq("status", "draft");

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting event:", error);
        return NextResponse.json(
            { error: "Failed to delete event" },
            { status: 500 }
        );
    }
}
