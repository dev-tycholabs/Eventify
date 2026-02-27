import { NextResponse } from "next/server";
import { circleClient } from "@/lib/circle";

// POST /api/circle/wallets
// Lists wallets for a Circle user
export async function POST(request: Request) {
    try {
        const { userToken } = await request.json();

        if (!userToken) {
            return NextResponse.json(
                { error: "userToken is required" },
                { status: 400 }
            );
        }

        const response = await circleClient.listWallets({ userToken });
        const wallets = response.data?.wallets || [];

        return NextResponse.json({ wallets });
    } catch (error) {
        console.error("Circle list wallets error:", error);
        return NextResponse.json(
            { error: "Failed to list wallets" },
            { status: 500 }
        );
    }
}
