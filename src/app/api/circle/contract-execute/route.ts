import { NextResponse } from "next/server";
import { circleClient } from "@/lib/circle";

// POST /api/circle/contract-execute
// Creates a challenge for executing a smart contract function
// Used for ticket purchases, marketplace listings, etc.
export async function POST(request: Request) {
    try {
        const {
            userToken,
            walletId,
            contractAddress,
            abiFunctionSignature,
            abiParameters,
            amount,
        } = await request.json();

        if (!userToken || !walletId || !contractAddress || !abiFunctionSignature) {
            return NextResponse.json(
                {
                    error: "userToken, walletId, contractAddress, and abiFunctionSignature are required",
                },
                { status: 400 }
            );
        }

        const response =
            await circleClient.createUserTransactionContractExecutionChallenge({
                userToken,
                walletId,
                contractAddress,
                abiFunctionSignature,
                abiParameters: abiParameters || [],
                amount: amount || undefined,
                fee: {
                    type: "level",
                    config: { feeLevel: "MEDIUM" },
                },
            });

        return NextResponse.json({
            challengeId: response.data?.challengeId,
        });
    } catch (error) {
        console.error("Circle contract execution error:", error);
        return NextResponse.json(
            { error: "Failed to create contract execution challenge" },
            { status: 500 }
        );
    }
}
