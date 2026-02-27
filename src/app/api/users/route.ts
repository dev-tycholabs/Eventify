import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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

// POST /api/users - Update user profile (JWT protected via middleware)
export async function POST(request: NextRequest) {
    try {
        // Address comes from JWT via middleware
        const address = request.headers.get("x-auth-address");

        if (!address) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { username, name, email, contact_number, bio, avatar_url } = body;

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

        // Upsert user
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
                { onConflict: "wallet_address" }
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
