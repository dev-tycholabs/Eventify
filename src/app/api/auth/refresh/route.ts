import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { randomBytes } from "crypto";

// POST /api/auth/refresh
export async function POST(request: NextRequest) {
    try {
        const refreshToken = request.cookies.get("eventify_refresh")?.value;

        if (!refreshToken) {
            return NextResponse.json(
                { error: "No refresh token" },
                { status: 401 }
            );
        }

        // Verify the refresh token JWT
        const payload = await verifyRefreshToken(refreshToken);
        if (!payload || !payload.address) {
            return NextResponse.json(
                { error: "Invalid refresh token" },
                { status: 401 }
            );
        }

        const address = payload.address.toLowerCase();
        const tokenHash = await hashToken(refreshToken);

        const supabase = createServerClient();

        // Find the refresh token in DB
        const { data: storedToken, error: tokenError } = await supabase
            .from("refresh_tokens")
            .select("id, wallet_address, token_hash, token_family, is_revoked, expires_at")
            .eq("wallet_address", address)
            .eq("token_hash", tokenHash)
            .eq("is_revoked", false)
            .single();

        if (tokenError || !storedToken) {
            // Token not found or already revoked — possible token theft
            return NextResponse.json(
                { error: "Invalid refresh token. Please sign in again." },
                { status: 401 }
            );
        }

        // Check expiry
        if (new Date(storedToken.expires_at) < new Date()) {
            await supabase.from("refresh_tokens").delete().eq("id", storedToken.id);
            return NextResponse.json(
                { error: "Refresh token expired" },
                { status: 401 }
            );
        }

        // Revoke old refresh token
        await supabase
            .from("refresh_tokens")
            .update({ is_revoked: true })
            .eq("id", storedToken.id);

        // Issue new tokens (rotation)
        const newAccessToken = await signAccessToken(address);
        const newRefreshToken = await signRefreshToken(address);

        // Store new refresh token with same family
        await supabase.from("refresh_tokens").insert({
            wallet_address: address,
            token_hash: await hashToken(newRefreshToken),
            token_family: storedToken.token_family,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        // Fetch user data
        const { data: user } = await supabase
            .from("users")
            .select("*")
            .eq("wallet_address", address)
            .single();

        const response = NextResponse.json({
            user,
            accessToken: newAccessToken,
        });

        response.cookies.set("eventify_refresh", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/api/auth",
            maxAge: 7 * 24 * 60 * 60,
        });

        return response;
    } catch (error) {
        console.error("Refresh error:", error);
        return NextResponse.json(
            { error: "Token refresh failed" },
            { status: 500 }
        );
    }
}

async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
