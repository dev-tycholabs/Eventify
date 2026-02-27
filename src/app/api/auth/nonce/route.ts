import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

// GET /api/auth/nonce?address=0x...
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get("address");

        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return NextResponse.json(
                { error: "Valid wallet address is required" },
                { status: 400 }
            );
        }

        const nonce = randomBytes(16).toString("hex");
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

        const supabase = createServerClient();

        // Delete any existing nonces for this address (cleanup)
        await supabase
            .from("auth_nonces")
            .delete()
            .eq("wallet_address", address.toLowerCase());

        // Insert new nonce
        const { error } = await supabase.from("auth_nonces").insert({
            wallet_address: address.toLowerCase(),
            nonce,
            expires_at: expiresAt,
        });

        if (error) throw error;

        return NextResponse.json({ nonce });
    } catch (error) {
        console.error("Error generating nonce:", error);
        return NextResponse.json(
            { error: "Failed to generate nonce" },
            { status: 500 }
        );
    }
}
