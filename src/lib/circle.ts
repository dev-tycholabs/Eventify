import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";

if (!process.env.CIRCLE_API_KEY) {
    throw new Error("CIRCLE_API_KEY is not set");
}

export const circleClient = initiateUserControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
});
