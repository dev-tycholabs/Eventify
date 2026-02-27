import { NextResponse } from "next/server";
import { circleClient } from "@/lib/circle";
import { createServerClient } from "@/lib/supabase/server";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { randomBytes } from "crypto";

// POST /api/circle/login
// After Circle email/social auth, this creates a session in Eventify
// using the user's Circle wallet address as the identity
export async function POST(request: Request) {
    try {
        const { userToken } = await request.json();

        if (!userToken) {
            return NextResponse.json(
                { error: "userToken is required" },
                { status: 400 }
            );
        }

        // Get user's wallets from Circle
        const walletsRes = await circleClient.listWallets({ userToken });
        const wallets = walletsRes.data?.wallets || [];

        if (wallets.length === 0) {
            return NextResponse.json(
                { error: "No wallets found. Please create a wallet first." },
                { status: 400 }
            );
        }

        // Use the first wallet's address as the user identity
        const primaryWallet = wallets[0];
        const address = primaryWallet.address.toLowerCase();

        const supabase = createServerClient();

        // Upsert user (same as SIWE login)
        const { data: user, error: userError } = await supabase
            .from("users")
            .upsert(
                {
                    wallet_address: address,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "wallet_address" }
            )
            .select()
            .single();

        if (userError) throw userError;

        // Generate Eventify JWT tokens (same as SIWE flow)
        const accessToken = await signAccessToken(address);
        const refreshToken = await signRefreshToken(address);

        // Store refresh token
        const tokenFamily = randomBytes(16).toString("hex");
        await supabase.from("refresh_tokens").insert({
            wallet_address: address,
            token_hash: await hashToken(refreshToken),
            token_family: tokenFamily,
            expires_at: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
        });

        // Set refresh token as HttpOnly cookie
        const response = NextResponse.json({
            user,
            accessToken,
            wallets,
        });

        response.cookies.set("eventify_refresh", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/api/auth",
            maxAge: 7 * 24 * 60 * 60,
        });

        return response;
    } catch (error) {
        console.error("Circle login error:", error);
        return NextResponse.json(
            { error: "Authentication failed" },
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
