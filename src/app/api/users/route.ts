import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyWalletSignature } from "@/lib/auth/verify-wallet";

// GET /api/users?address=0x... or GET /api/users?username=...
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get("address");
        const username = searchParams.get("username");

        if (!address && !username) {
            return NextResponse.json(
                { error: "Address or username is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        let query = supabase.from("users").select("*");

        if (address) {
            query = query.eq("wallet_address", address.toLowerCase());
        } else if (username) {
            query = query.eq("username", username.toLowerCase());
        }

        const { data, error } = await query.single();

        if (error && error.code !== "PGRST116") {
            // PGRST116 = no rows returned
            throw error;
        }

        return NextResponse.json({ user: data });
    } catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json(
            { error: "Failed to fetch user" },
            { status: 500 }
        );
    }
}

// POST /api/users - Create or update user profile
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, signature, message, username, name, email, contact_number, bio, avatar_url } = body;

        // Validate required fields
        if (!address || !signature || !message) {
            return NextResponse.json(
                { error: "Address, signature, and message are required" },
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

        // Check username uniqueness if provided
        if (username) {
            const { data: existingUser } = await supabase
                .from("users")
                .select("wallet_address")
                .eq("username", username.toLowerCase())
                .single();

            if (existingUser && existingUser.wallet_address !== address.toLowerCase()) {
                return NextResponse.json(
                    { error: "Username is already taken" },
                    { status: 409 }
                );
            }
        }

        // Upsert user (create if not exists, update if exists)
        const { data, error } = await supabase
            .from("users")
            .upsert(
                {
                    wallet_address: address.toLowerCase(),
                    username: username?.toLowerCase(),
                    name,
                    email,
                    contact_number,
                    bio,
                    avatar_url,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "wallet_address",
                }
            )
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ user: data });
    } catch (error) {
        console.error("Error creating/updating user:", error);
        return NextResponse.json(
            { error: "Failed to save user" },
            { status: 500 }
        );
    }
}
