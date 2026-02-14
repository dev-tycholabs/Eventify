import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/users/check-username?username=xxx&currentAddress=0x...
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get("username");
        const currentAddress = searchParams.get("currentAddress");

        if (!username) {
            return NextResponse.json(
                { error: "Username is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();
        const { data, error } = await supabase
            .from("users")
            .select("wallet_address")
            .eq("username", username.toLowerCase())
            .single();

        if (error && error.code !== "PGRST116") {
            throw error;
        }

        // Username is available if no user found, or if it belongs to current user
        const isAvailable = !data || (currentAddress && data.wallet_address === currentAddress.toLowerCase());

        return NextResponse.json({ available: isAvailable });
    } catch (error) {
        console.error("Error checking username:", error);
        return NextResponse.json(
            { error: "Failed to check username" },
            { status: 500 }
        );
    }
}
