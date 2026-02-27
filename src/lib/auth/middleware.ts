import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./jwt";

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Returns the wallet address if valid, or a 401 response if not.
 */
export async function authenticateRequest(
    request: NextRequest
): Promise<{ address: string } | NextResponse> {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: "Missing or invalid Authorization header" },
            { status: 401 }
        );
    }

    const token = authHeader.slice(7);
    const payload = await verifyAccessToken(token);

    if (!payload || !payload.address) {
        return NextResponse.json(
            { error: "Invalid or expired token" },
            { status: 401 }
        );
    }

    return { address: payload.address };
}
