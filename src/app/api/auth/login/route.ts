import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { SiweMessage } from "siwe";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { randomBytes } from "crypto";

// POST /api/auth/login
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message, signature } = body;

        if (!message || !signature) {
            return NextResponse.json(
                { error: "Message and signature are required" },
                { status: 400 }
            );
        }

        // Parse and verify the SIWE message
        const siweMessage = new SiweMessage(message);
        const { data: verification, success, error: verifyError } = await siweMessage.verify({
            signature,
        });

        if (!success || verifyError) {
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            );
        }

        const address = verification.address.toLowerCase();
        const nonce = verification.nonce;

        const supabase = createServerClient();

        // Validate nonce exists and hasn't expired
        const { data: nonceRecord, error: nonceError } = await supabase
            .from("auth_nonces")
            .select("id, wallet_address, nonce, expires_at")
            .eq("wallet_address", address)
            .eq("nonce", nonce)
            .single();

        if (nonceError || !nonceRecord) {
            return NextResponse.json(
                { error: "Invalid or expired nonce" },
                { status: 401 }
            );
        }

        // Check nonce expiry
        if (new Date(nonceRecord.expires_at) < new Date()) {
            // Cleanup expired nonce
            await supabase.from("auth_nonces").delete().eq("id", nonceRecord.id);
            return NextResponse.json(
                { error: "Nonce has expired. Please try again." },
                { status: 401 }
            );
        }

        // Delete used nonce (single-use)
        await supabase.from("auth_nonces").delete().eq("id", nonceRecord.id);

        // Upsert user
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

        // Generate tokens
        const accessToken = await signAccessToken(address);
        const refreshToken = await signRefreshToken(address);

        // Store refresh token in DB (hashed for security)
        const tokenFamily = randomBytes(16).toString("hex");
        await supabase.from("refresh_tokens").insert({
            wallet_address: address,
            token_hash: await hashToken(refreshToken),
            token_family: tokenFamily,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        // Set refresh token as HttpOnly cookie
        const response = NextResponse.json({
            user,
            accessToken,
        });

        response.cookies.set("eventify_refresh", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/api/auth",
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        });

        return response;
    } catch (error) {
        console.error("Login error:", error);
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
