"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    ReactNode,
} from "react";

interface CircleWallet {
    id: string;
    address: string;
    blockchain: string;
    state: string;
}

interface CircleAuthContextType {
    circleUserToken: string | null;
    circleEncryptionKey: string | null;
    circleWallets: CircleWallet[];
    isCircleAuthenticated: boolean;
    isCircleAuthenticating: boolean;
    loginWithEmail: (email: string) => Promise<void>;
    verifyOtp: () => void;
    createWallet: () => Promise<string | null>;
    executeChallenge: (challengeId: string) => void;
    circleLogin: () => Promise<boolean>;
    circleLogout: () => void;
}

const CircleAuthContext = createContext<CircleAuthContextType | null>(null);

export function CircleAuthProvider({ children }: { children: ReactNode }) {
    const [circleUserToken, setCircleUserToken] = useState<string | null>(null);
    const [circleEncryptionKey, setCircleEncryptionKey] = useState<string | null>(null);
    const [circleWallets, setCircleWallets] = useState<CircleWallet[]>([]);
    const [isCircleAuthenticating, setIsCircleAuthenticating] = useState(false);

    const sdkRef = useRef<ReturnType<typeof import("@/lib/circle-sdk").getCircleSdkWithCallback> | null>(null);
    const emailRef = useRef<string>("");
    const deviceIdRef = useRef<string>("");

    const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID || "";

    // Initialize SDK with login callback
    const initSdk = useCallback(() => {
        if (sdkRef.current) return sdkRef.current;

        const { getCircleSdkWithCallback } = require("@/lib/circle-sdk");
        const sdk = getCircleSdkWithCallback(
            (error: unknown, result: Record<string, string>) => {
                if (error) {
                    console.error("Circle login error:", error);
                    setIsCircleAuthenticating(false);
                    return;
                }
                if (result) {
                    setCircleUserToken(result.userToken);
                    setCircleEncryptionKey(result.encryptionKey);
                }
            }
        );
        sdkRef.current = sdk;
        return sdk;
    }, []);

    // Step 1: Send OTP to email
    const loginWithEmail = useCallback(
        async (email: string) => {
            setIsCircleAuthenticating(true);
            emailRef.current = email;

            try {
                const sdk = initSdk();
                const deviceId = await sdk.getDeviceId();
                deviceIdRef.current = deviceId;

                // Call backend to send OTP
                const res = await fetch("/api/circle/email-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deviceId, email }),
                });

                if (!res.ok) throw new Error("Failed to send OTP");
                const data = await res.json();

                // Configure SDK with tokens
                sdk.updateConfigs({
                    appSettings: { appId },
                    loginConfigs: {
                        deviceToken: data.deviceToken,
                        deviceEncryptionKey: data.deviceEncryptionKey,
                        otpToken: data.otpToken,
                    },
                });

                // Set up resend handler
                sdk.setOnResendOtpEmail(async () => {
                    await fetch("/api/circle/email-resend", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            deviceId: deviceIdRef.current,
                            email: emailRef.current,
                            otpToken: data.otpToken,
                        }),
                    });
                });
            } catch (error) {
                console.error("Email login error:", error);
                setIsCircleAuthenticating(false);
                throw error;
            }
        },
        [appId, initSdk]
    );

    // Step 2: Open OTP verification modal
    const verifyOtp = useCallback(() => {
        const sdk = sdkRef.current;
        if (!sdk) return;
        sdk.verifyOtp();
    }, []);

    // Step 3: Create wallet after auth
    const createWallet = useCallback(async (): Promise<string | null> => {
        if (!circleUserToken) return null;

        try {
            const res = await fetch("/api/circle/create-wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userToken: circleUserToken,
                    blockchains: ["ETH-SEPOLIA", "MATIC-AMOY", "AVAX-FUJI"],
                }),
            });

            if (!res.ok) throw new Error("Failed to create wallet");
            const data = await res.json();
            return data.challengeId;
        } catch (error) {
            console.error("Create wallet error:", error);
            return null;
        }
    }, [circleUserToken]);

    // Execute a challenge (PIN entry, wallet creation, tx signing)
    const executeChallenge = useCallback(
        (challengeId: string) => {
            const sdk = sdkRef.current || initSdk();
            sdk.setAppSettings({ appId });

            if (circleUserToken && circleEncryptionKey) {
                sdk.setAuthentication({
                    userToken: circleUserToken,
                    encryptionKey: circleEncryptionKey,
                });
            }

            sdk.execute(challengeId, (error: unknown, result: Record<string, string>) => {
                if (error) {
                    console.error("Challenge execution error:", error);
                    return;
                }
                console.log("Challenge completed:", result?.type, result?.status);
            });
        },
        [appId, circleUserToken, circleEncryptionKey, initSdk]
    );

    // Login to Eventify using Circle wallet address
    const circleLogin = useCallback(async (): Promise<boolean> => {
        if (!circleUserToken) return false;

        try {
            const res = await fetch("/api/circle/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userToken: circleUserToken }),
            });

            if (!res.ok) return false;
            const data = await res.json();
            setCircleWallets(data.wallets || []);
            setIsCircleAuthenticating(false);
            return true;
        } catch (error) {
            console.error("Circle login error:", error);
            setIsCircleAuthenticating(false);
            return false;
        }
    }, [circleUserToken]);

    const circleLogout = useCallback(() => {
        setCircleUserToken(null);
        setCircleEncryptionKey(null);
        setCircleWallets([]);
        sdkRef.current = null;
    }, []);

    return (
        <CircleAuthContext.Provider
            value={{
                circleUserToken,
                circleEncryptionKey,
                circleWallets,
                isCircleAuthenticated: !!circleUserToken && circleWallets.length > 0,
                isCircleAuthenticating,
                loginWithEmail,
                verifyOtp,
                createWallet,
                executeChallenge,
                circleLogin,
                circleLogout,
            }}
        >
            {children}
        </CircleAuthContext.Provider>
    );
}

export function useCircleAuth() {
    const context = useContext(CircleAuthContext);
    if (!context) {
        throw new Error("useCircleAuth must be used within a CircleAuthProvider");
    }
    return context;
}
