import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Routes that require JWT authentication
const PROTECTED_API_ROUTES = [
    "/api/comments",
    "/api/events",
    "/api/tickets",
    "/api/transactions",
    "/api/upload",
    "/api/marketplace",
    "/api/chat",
    "/api/wallet",
    "/api/users",
];

// Routes that are always public (no auth needed)
const PUBLIC_API_ROUTES = [
    "/api/auth/",       // Auth endpoints themselves
    "/api/locations",   // Public location data
];

// Methods that don't require auth (read-only)
const PUBLIC_METHODS = ["GET", "HEAD", "OPTIONS"];

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not set");
    return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only intercept API routes
    if (!pathname.startsWith("/api/")) {
        return NextResponse.next();
    }

    // Allow public routes
    if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Allow GET requests on protected routes (public reads)
    if (PUBLIC_METHODS.includes(request.method)) {
        return NextResponse.next();
    }

    // Check if this is a protected route
    const isProtected = PROTECTED_API_ROUTES.some((route) =>
        pathname.startsWith(route)
    );

    if (!isProtected) {
        return NextResponse.next();
    }

    // Validate JWT
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
        );
    }

    const token = authHeader.slice(7);

    try {
        const { payload } = await jwtVerify(token, getSecret(), {
            issuer: "eventify",
        });

        if (!payload.sub) {
            return NextResponse.json(
                { error: "Invalid token" },
                { status: 401 }
            );
        }

        // Add the authenticated wallet address to the request headers
        // so API route handlers can access it
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-auth-address", payload.sub);

        return NextResponse.next({
            request: { headers: requestHeaders },
        });
    } catch {
        return NextResponse.json(
            { error: "Invalid or expired token" },
            { status: 401 }
        );
    }
}

export const config = {
    matcher: "/api/:path*",
};
