import { NextResponse } from "next/server";
import { circleClient } from "@/lib/circle";

// POST /api/circle/email-resend
// Resends OTP to user's email
export async function POST(request: Request) {
    try {
        const { deviceId, email, otpToken, userToken } = await request.json();

        if (!deviceId || !email || !otpToken) {
            return NextResponse.json(
                { error: "deviceId, email, and otpToken are required" },
                { status: 400 }
            );
        }

        const response = await circleClient.resendOTP({
            deviceId,
            email,
            otpToken,
            userToken: userToken || "",
        });

        return NextResponse.json({
            otpToken: response.data?.otpToken,
        });
    } catch (error) {
        console.error("Circle email resend error:", error);
        return NextResponse.json(
            { error: "Failed to resend OTP" },
            { status: 500 }
        );
    }
}
