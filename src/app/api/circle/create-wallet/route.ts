import { NextResponse } from "next/server";
import { circleClient } from "@/lib/circle";
import type { Blockchain } from "@circle-fin/user-controlled-wallets";

// POST /api/circle/create-wallet
// Creates a wallet challenge for the user after authentication
export async function POST(request: Request) {
    try {
        const { userToken, blockchains } = await request.json();

        if (!userToken) {
            return NextResponse.json(
                { error: "userToken is required" },
                { status: 400 }
            );
        }

        const defaultBlockchains: Blockchain[] = [
            "ETH-SEPOLIA",
            "MATIC-AMOY",
            "AVAX-FUJI",
        ];

        const response = await circleClient.createUserPinWithWallets({
            userToken,
            blockchains: blockchains || defaultBlockchains,
            accountType: "EOA",
        });

        return NextResponse.json({
            challengeId: response.data?.challengeId,
        });
    } catch (error) {
        console.error("Circle create wallet error:", error);
        return NextResponse.json(
            { error: "Failed to create wallet" },
            { status: 500 }
        );
    }
}
