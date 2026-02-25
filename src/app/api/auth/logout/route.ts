import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyRefreshToken } from "@/lib/auth/jwt";

// POST /api/auth/logout
export async function POST(request: NextRequest) {
    try {
        const refreshToken = request.cookies.get("eventify_refresh")?.value;

        if (refreshToken) {
            const payload = await verifyRefreshToken(refreshToken);
            if (payload?.address) {
                const supabase = createServerClient();

                // Revoke all refresh tokens for this user
                await supabase
                    .from("refresh_tokens")
                    .update({ is_revoked: true })
                    .eq("wallet_address", payload.address.toLowerCase());
            }
        }

        const response = NextResponse.json({ success: true });

        // Clear the refresh token cookie
        response.cookies.set("eventify_refresh", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/api/auth",
            maxAge: 0,
        });

        return response;
    } catch (error) {
        console.error("Logout error:", error);
        // Still clear the cookie even if server-side cleanup fails
        const response = NextResponse.json({ success: true });
        response.cookies.set("eventify_refresh", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/api/auth",
            maxAge: 0,
        });
        return response;
    }
}
