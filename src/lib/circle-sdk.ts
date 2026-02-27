"use client";

import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

let sdk: W3SSdk | null = null;

export function getCircleSdk(): W3SSdk {
    if (!sdk) {
        sdk = new W3SSdk();
    }
    return sdk;
}

export function getCircleSdkWithCallback(
    onLoginComplete: (error: unknown, result: unknown) => void
): W3SSdk {
    sdk = new W3SSdk({}, onLoginComplete);
    return sdk;
}
