import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { ListingStatus, InsertTables, UpdateTables, Tables } from "@/lib/supabase/types";

type MarketplaceListing = Tables<"marketplace_listings">;

// GET /api/marketplace - List marketplace listings
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") as ListingStatus | null;
        const seller = searchParams.get("seller");
        const eventContract = searchParams.get("event_contract");
        const chainId = searchParams.get("chain_id") ? parseInt(searchParams.get("chain_id")!) : null;
        const limit = parseInt(searchParams.get("limit") || "100");
        const offset = parseInt(searchParams.get("offset") || "0");

        const supabase = createServerClient();

        let query = supabase
            .from("marketplace_listings")
            .select(`
                *,
                events (
                    id,
                    name,
                    date,
                    venue,
                    image_url,
                    ticket_price
                )
            `)
            .order("listed_at", { ascending: false })
            .range(offset, offset + limit - 1);

        // Default to active listings if no status specified
        if (status) {
            query = query.eq("status", status);
        } else {
            query = query.eq("status", "active");
        }

        if (seller) {
            query = query.eq("seller_address", seller.toLowerCase());
        }

        if (eventContract) {
            query = query.eq("event_contract_address", eventContract.toLowerCase());
        }

        if (chainId) {
            query = query.eq("chain_id", chainId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Get total count with same filters
        const countQuery = supabase
            .from("marketplace_listings")
            .select("id", { count: "exact", head: true });

        if (status) {
            countQuery.eq("status", status);
        } else {
            countQuery.eq("status", "active");
        }
        if (seller) countQuery.eq("seller_address", seller.toLowerCase());
        if (eventContract) countQuery.eq("event_contract_address", eventContract.toLowerCase());
        if (chainId) countQuery.eq("chain_id", chainId);

        const { count: totalCount } = await countQuery;

        return NextResponse.json({ listings: data, totalCount: totalCount ?? 0 });
    } catch (error) {
        console.error("Error fetching marketplace listings:", error);
        return NextResponse.json(
            { error: "Failed to fetch listings" },
            { status: 500 }
        );
    }
}


// POST /api/marketplace - Create or update a listing
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            listing_id,
            token_id,
            event_contract_address,
            event_id,
            seller_address,
            price,
            status = "active",
            buyer_address,
            tx_hash,
            chain_id,
            action, // "list", "buy", "cancel"
        } = body;

        if (!listing_id || !seller_address || !chain_id) {
            return NextResponse.json(
                { error: "Missing required fields (listing_id, seller_address, chain_id)" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        if (action === "list") {
            // Create new listing
            const insertData: InsertTables<"marketplace_listings"> = {
                chain_id: chain_id as number,
                listing_id: listing_id.toString(),
                token_id: token_id.toString(),
                event_contract_address: event_contract_address.toLowerCase(),
                event_id: event_id || null,
                seller_address: seller_address.toLowerCase(),
                price: price.toString(),
                status: "active",
                tx_hash,
            };

            const { data, error } = await supabase
                .from("marketplace_listings")
                .upsert(insertData, { onConflict: "chain_id,listing_id" })
                .select()
                .single();

            if (error) throw error;

            // Update ticket to mark as listed
            await supabase
                .from("user_tickets")
                .update({ is_listed: true, listing_id: listing_id.toString() })
                .eq("event_contract_address", event_contract_address.toLowerCase())
                .eq("token_id", token_id.toString())
                .eq("chain_id", chain_id);

            return NextResponse.json({ listing: data });
        }

        if (action === "buy") {
            // Update listing as sold
            const updateData: UpdateTables<"marketplace_listings"> = {
                status: "sold",
                buyer_address: buyer_address?.toLowerCase(),
                sold_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from("marketplace_listings")
                .update(updateData)
                .eq("listing_id", listing_id.toString())
                .eq("chain_id", chain_id)
                .select()
                .single();

            if (error) throw error;

            // Transfer ticket ownership
            const listing = data as MarketplaceListing | null;
            if (listing) {
                await supabase
                    .from("user_tickets")
                    .update({
                        owner_address: buyer_address?.toLowerCase(),
                        is_listed: false,
                        listing_id: null,
                    })
                    .eq("event_contract_address", listing.event_contract_address)
                    .eq("token_id", listing.token_id)
                    .eq("chain_id", chain_id);

                // Track royalty earnings for recipients
                // Find the event and its royalty config
                const eventContractAddr = listing.event_contract_address;
                const salePrice = BigInt(listing.price);

                const { data: eventData } = await supabase
                    .from("events")
                    .select("id, royalty_percent")
                    .eq("contract_address", eventContractAddr)
                    .eq("chain_id", chain_id)
                    .single();

                if (eventData && eventData.royalty_percent) {
                    const royaltyBasisPoints = BigInt(Math.round(parseFloat(eventData.royalty_percent) * 100));
                    // Total royalty amount from this sale (same calc as the smart contract)
                    const totalRoyalty = (salePrice * royaltyBasisPoints) / BigInt(10000);

                    if (totalRoyalty > BigInt(0)) {
                        // Fetch all recipients for this event
                        const { data: recipients } = await supabase
                            .from("royalty_recipients")
                            .select("id, percentage, royalty_earned")
                            .eq("event_id", eventData.id);

                        if (recipients && recipients.length > 0) {
                            // Distribute totalRoyalty among recipients based on their share
                            for (const recipient of recipients) {
                                const shareBasisPoints = BigInt(Math.round(recipient.percentage * 100));
                                const recipientEarned = (totalRoyalty * shareBasisPoints) / BigInt(10000);
                                const previousEarned = BigInt(recipient.royalty_earned || "0");
                                const newTotal = previousEarned + recipientEarned;

                                await supabase
                                    .from("royalty_recipients")
                                    .update({ royalty_earned: newTotal.toString() })
                                    .eq("id", recipient.id);
                            }
                        }
                    }
                }
            }

            return NextResponse.json({ listing: data });
        }

        if (action === "cancel") {
            // Cancel listing
            const updateData: UpdateTables<"marketplace_listings"> = {
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from("marketplace_listings")
                .update(updateData)
                .eq("listing_id", listing_id.toString())
                .eq("seller_address", seller_address.toLowerCase())
                .eq("chain_id", chain_id)
                .select()
                .single();

            if (error) throw error;

            // Update ticket to mark as not listed
            const listing = data as MarketplaceListing | null;
            if (listing) {
                await supabase
                    .from("user_tickets")
                    .update({ is_listed: false, listing_id: null })
                    .eq("event_contract_address", listing.event_contract_address)
                    .eq("token_id", listing.token_id)
                    .eq("chain_id", chain_id);
            }

            return NextResponse.json({ listing: data });
        }

        return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 }
        );
    } catch (error) {
        console.error("Error updating marketplace listing:", error);
        return NextResponse.json(
            { error: "Failed to update listing" },
            { status: 500 }
        );
    }
}
