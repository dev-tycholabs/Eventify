"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
    ReactNode,
} from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";
import type { Tables } from "@/lib/supabase/types";
import { notify } from "@/utils/toast";

type User = Tables<"users">;

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isAuthenticating: boolean;
    accessToken: string | null;
    signIn: () => Promise<boolean>;
    signOut: () => void;
    updateProfile: (data: Partial<User>) => Promise<User | null>;
    getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Token refresh buffer — refresh 2 minutes before expiry
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
    const { address, isConnected, chainId } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { disconnect } = useDisconnect();

    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [hasPrompted, setHasPrompted] = useState(false);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Parse JWT expiry from the token payload
    const getTokenExpiry = useCallback((token: string): number | null => {
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            return payload.exp ? payload.exp * 1000 : null;
        } catch {
            return null;
        }
    }, []);

    // Schedule automatic token refresh
    const scheduleRefresh = useCallback(
        (token: string) => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }

            const expiry = getTokenExpiry(token);
            if (!expiry) return;

            const refreshIn = expiry - Date.now() - REFRESH_BUFFER_MS;
            if (refreshIn <= 0) return;

            refreshTimerRef.current = setTimeout(async () => {
                try {
                    const res = await fetch("/api/auth/refresh", {
                        method: "POST",
                        credentials: "include",
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setAccessToken(data.accessToken);
                        if (data.user) setUser(data.user);
                        scheduleRefresh(data.accessToken);
                    } else {
                        // Refresh failed — clear auth state
                        setAccessToken(null);
                        setUser(null);
                    }
                } catch {
                    setAccessToken(null);
                    setUser(null);
                }
            }, refreshIn);
        },
        [getTokenExpiry]
    );

    // Get a valid access token, refreshing if needed
    const getAccessToken = useCallback(async (): Promise<string | null> => {
        if (accessToken) {
            const expiry = getTokenExpiry(accessToken);
            if (expiry && expiry - Date.now() > REFRESH_BUFFER_MS) {
                return accessToken;
            }
        }

        // Try to refresh
        try {
            const res = await fetch("/api/auth/refresh", {
                method: "POST",
                credentials: "include",
            });

            if (res.ok) {
                const data = await res.json();
                setAccessToken(data.accessToken);
                if (data.user) setUser(data.user);
                scheduleRefresh(data.accessToken);
                return data.accessToken;
            }
        } catch {
            // Refresh failed
        }

        return null;
    }, [accessToken, getTokenExpiry, scheduleRefresh]);

    // Sign in with SIWE
    const signIn = useCallback(async (): Promise<boolean> => {
        if (!address || !chainId || isAuthenticating) return false;

        setIsAuthenticating(true);

        try {
            // 1. Get nonce from server
            const nonceRes = await fetch(`/api/auth/nonce?address=${address}`);
            if (!nonceRes.ok) throw new Error("Failed to get nonce");
            const { nonce } = await nonceRes.json();

            // 2. Build SIWE message
            const siweMessage = new SiweMessage({
                domain: window.location.host,
                address,
                statement: "Sign in to Eventify to verify your wallet and access your account.",
                uri: window.location.origin,
                version: "1",
                chainId,
                nonce,
                issuedAt: new Date().toISOString(),
            });

            const messageToSign = siweMessage.prepareMessage();

            // 3. Request wallet signature
            const signature = await signMessageAsync({ message: messageToSign });

            // 4. Send to server for verification + JWT issuance
            const loginRes = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    message: messageToSign,
                    signature,
                }),
            });

            if (!loginRes.ok) {
                const err = await loginRes.json();
                throw new Error(err.error || "Authentication failed");
            }

            const data = await loginRes.json();

            setUser(data.user);
            setAccessToken(data.accessToken);
            scheduleRefresh(data.accessToken);

            return true;
        } catch (error) {
            setUser(null);
            setAccessToken(null);

            // If user rejected the signature request, disconnect the wallet
            const isUserRejection =
                error instanceof Error &&
                (error.name === "UserRejectedRequestError" ||
                    error.message.toLowerCase().includes("user rejected"));

            if (isUserRejection) {
                notify.warning("Sign-in cancelled. Wallet disconnected.");
                disconnect();
            } else {
                notify.error("Sign-in failed. Please try again.");
            }

            return false;
        } finally {
            setIsAuthenticating(false);
        }
    }, [address, chainId, isAuthenticating, signMessageAsync, scheduleRefresh]);

    // Sign out
    const signOut = useCallback(async () => {
        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
            });
        } catch {
            // Best effort
        }

        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        setUser(null);
        setAccessToken(null);
        setHasPrompted(false);
        disconnect();
    }, [disconnect]);

    // Update user profile
    const updateProfile = useCallback(
        async (data: Partial<User>): Promise<User | null> => {
            const token = await getAccessToken();
            if (!token || !address) return null;

            try {
                const res = await fetch("/api/users", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(data),
                });

                const result = await res.json();

                if (!res.ok) {
                    throw new Error(result.error || "Failed to update profile");
                }

                setUser(result.user);
                return result.user;
            } catch (error) {
                console.error("Profile update failed:", error);
                return null;
            }
        },
        [address, getAccessToken]
    );

    // Auto sign-in: try refresh first, then prompt signature
    useEffect(() => {
        if (!isConnected || !address) {
            // Call logout API to revoke refresh tokens and clear cookie
            if (user || accessToken) {
                fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "include",
                }).catch(() => {
                    // Best effort — still clear local state
                });
            }

            setUser(null);
            setAccessToken(null);
            setHasPrompted(false);
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }
            return;
        }

        if (user || isAuthenticating) return;

        // Try to restore session via refresh token
        const tryRestore = async () => {
            try {
                const res = await fetch("/api/auth/refresh", {
                    method: "POST",
                    credentials: "include",
                });

                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    setAccessToken(data.accessToken);
                    scheduleRefresh(data.accessToken);
                    return;
                }
            } catch {
                // Refresh failed
            }

            // No valid session — prompt sign in
            if (!hasPrompted) {
                setHasPrompted(true);
                signIn();
            }
        };

        tryRestore();
    }, [isConnected, address, user, hasPrompted, isAuthenticating, signIn, scheduleRefresh]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }
        };
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user && !!accessToken,
                isAuthenticating,
                accessToken,
                signIn,
                signOut,
                updateProfile,
                getAccessToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
