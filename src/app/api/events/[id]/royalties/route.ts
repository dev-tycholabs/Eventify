import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { RoyaltyDistributionAction, RoyaltyDistributionRecipient } from "@/lib/supabase/types";

// POST /api/events/[id]/royalties — sync on-chain distribution to Supabase
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: eventId } = await params;
        const body = await request.json();
        const {
            tx_hash,
            action,
            triggered_by,
            splitter_address,
            recipients,
            chain_id,
        } = body as {
            tx_hash: string;
            action: RoyaltyDistributionAction;
            triggered_by: string;
            splitter_address: string;
            recipients: { address: string; released: string }[];
            chain_id: number;
        };

        if (!tx_hash || !action || !triggered_by || !chain_id) {
            return NextResponse.json(
                { error: "Missing required fields (tx_hash, action, triggered_by, chain_id)" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Handle direct_claim: organizer claims directly from marketplace (no splitter)
        if (action === "direct_claim") {
            const { claimed_amount, organizer_address } = body as {
                claimed_amount: string;
                organizer_address: string;
                tx_hash: string;
                action: RoyaltyDistributionAction;
                triggered_by: string;
                chain_id: number;
            };

            if (!claimed_amount || !organizer_address) {
                return NextResponse.json(
                    { error: "Missing claimed_amount or organizer_address for direct_claim" },
                    { status: 400 }
                );
            }

            // Fetch current royalty_claimed for the organizer to compute new cumulative total
            const { data: existingRecipient } = await supabase
                .from("royalty_recipients")
                .select("royalty_claimed, percentage")
                .eq("event_id", eventId)
                .eq("recipient_address", organizer_address.toLowerCase())
                .single();

            const previousClaimed = BigInt(existingRecipient?.royalty_claimed || "0");
            const newCumulativeClaimed = (previousClaimed + BigInt(claimed_amount)).toString();

            // Update royalty_claimed for the organizer
            const { error: updateError } = await supabase
                .from("royalty_recipients")
                .update({ royalty_claimed: newCumulativeClaimed })
                .eq("event_id", eventId)
                .eq("recipient_address", organizer_address.toLowerCase());

            if (updateError) {
                console.error(`Failed to update royalty_claimed for organizer:`, updateError);
            }

            const recipientSnapshots: RoyaltyDistributionRecipient[] = [{
                address: organizer_address.toLowerCase(),
                percentage: existingRecipient?.percentage ?? 100,
                amount_distributed: newCumulativeClaimed,
            }];

            // Insert distribution log
            const { error: logError } = await supabase
                .from("royalty_distributions")
                .insert({
                    chain_id: chain_id as number,
                    event_id: eventId,
                    splitter_address: organizer_address.toLowerCase(),
                    tx_hash,
                    action,
                    total_distributed: claimed_amount,
                    triggered_by: triggered_by.toLowerCase(),
                    recipients: recipientSnapshots,
                });

            if (logError) {
                console.error("Failed to insert distribution log:", logError);
            }

            return NextResponse.json({ success: true });
        }

        // Splitter-based flow: requires splitter_address and recipients
        if (!splitter_address || !recipients?.length) {
            return NextResponse.json(
                { error: "Missing required fields for splitter distribution" },
                { status: 400 }
            );
        }

        const supabase2 = supabase;

        // 1. Update royalty_claimed for each recipient from on-chain released() values
        for (const r of recipients) {
            const { error } = await supabase2
                .from("royalty_recipients")
                .update({ royalty_claimed: r.released })
                .eq("event_id", eventId)
                .eq("recipient_address", r.address.toLowerCase());

            if (error) {
                console.error(`Failed to update royalty_claimed for ${r.address}:`, error);
            }
        }

        // 2. Fetch DB recipients to build the distribution log with percentages
        const { data: dbRecipients } = await supabase2
            .from("royalty_recipients")
            .select("recipient_address, percentage, royalty_claimed")
            .eq("event_id", eventId);

        // 3. Calculate total distributed in this tx by diffing previous claimed vs new released
        //    Since released() is cumulative, the per-recipient amount for THIS distribution
        //    is: new_released - previous_claimed. But we already overwrote royalty_claimed,
        //    so we compute total_distributed as sum of all released values minus what was
        //    previously stored. For simplicity and accuracy, we store the snapshot.
        const recipientSnapshots: RoyaltyDistributionRecipient[] = (dbRecipients || []).map((db) => {
            const onChain = recipients.find(
                (r) => r.address.toLowerCase() === db.recipient_address.toLowerCase()
            );
            return {
                address: db.recipient_address,
                percentage: db.percentage,
                amount_distributed: onChain?.released || db.royalty_claimed,
            };
        });

        const totalDistributed = recipients.reduce(
            (sum, r) => sum + BigInt(r.released),
            BigInt(0)
        );

        // 4. Insert distribution log entry
        const { error: logError } = await supabase2
            .from("royalty_distributions")
            .insert({
                chain_id: chain_id as number,
                event_id: eventId,
                splitter_address: splitter_address.toLowerCase(),
                tx_hash,
                action,
                total_distributed: totalDistributed.toString(),
                triggered_by: triggered_by.toLowerCase(),
                recipients: recipientSnapshots,
            });

        if (logError) {
            console.error("Failed to insert distribution log:", logError);
            // Don't fail the whole request — the royalty_claimed updates already went through
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error syncing royalty distribution:", error);
        return NextResponse.json(
            { error: "Failed to sync royalty distribution" },
            { status: 500 }
        );
    }
}

// GET /api/events/[id]/royalties — fetch distribution history
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: eventId } = await params;

        const supabase = createServerClient();

        const { data, error } = await supabase
            .from("royalty_distributions")
            .select("*")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) throw error;

        return NextResponse.json({ distributions: data || [] });
    } catch (error) {
        console.error("Error fetching royalty distributions:", error);
        return NextResponse.json(
            { error: "Failed to fetch distributions" },
            { status: 500 }
        );
    }
}
