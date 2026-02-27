import { NextResponse } from "next/server";
import { circleClient } from "@/lib/circle";

// POST /api/circle/email-token
// Gets a device token and sends OTP to user's email
export async function POST(request: Request) {
    try {
        const { deviceId, email } = await request.json();

        if (!deviceId || !email) {
            return NextResponse.json(
                { error: "deviceId and email are required" },
                { status: 400 }
            );
        }

        const response = await circleClient.createDeviceTokenForEmailLogin({
            deviceId,
            email,
        });

        return NextResponse.json({
            deviceToken: response.data?.deviceToken,
            deviceEncryptionKey: response.data?.deviceEncryptionKey,
            otpToken: response.data?.otpToken,
        });
    } catch (error) {
        console.error("Circle email token error:", error);
        return NextResponse.json(
            { error: "Failed to send OTP" },
            { status: 500 }
        );
    }
}
