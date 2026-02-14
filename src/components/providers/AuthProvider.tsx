"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import type { Tables } from "@/lib/supabase/types";

type User = Tables<"users">;

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isAuthenticating: boolean;
    signIn: () => Promise<boolean>;
    signOut: () => void;
    updateProfile: (data: Partial<User>) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_STORAGE_KEY = "eventify_auth";

interface StoredAuth {
    address: string;
    signature: string;
    message: string;
    timestamp: number;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { disconnect } = useDisconnect();

    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [hasPrompted, setHasPrompted] = useState(false);

    // Check if we have a valid stored auth session
    const getStoredAuth = useCallback((): StoredAuth | null => {
        if (typeof window === "undefined") return null;
        try {
            const stored = localStorage.getItem(AUTH_STORAGE_KEY);
            if (!stored) return null;

            const auth: StoredAuth = JSON.parse(stored);
            // Check if auth is for current address and not expired (24 hours)
            const isValid =
                auth.address?.toLowerCase() === address?.toLowerCase() &&
                Date.now() - auth.timestamp < 24 * 60 * 60 * 1000;

            return isValid ? auth : null;
        } catch {
            return null;
        }
    }, [address]);

    // Store auth session
    const storeAuth = useCallback(
        (signature: string, message: string) => {
            if (!address) return;
            const auth: StoredAuth = {
                address,
                signature,
                message,
                timestamp: Date.now(),
            };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        },
        [address]
    );

    // Clear auth session
    const clearAuth = useCallback(() => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
        setHasPrompted(false);
    }, []);

    // Fetch user from API
    const fetchUser = useCallback(async (walletAddress: string): Promise<User | null> => {
        try {
            const res = await fetch(`/api/users?address=${walletAddress}`);
            const data = await res.json();
            return data.user || null;
        } catch {
            return null;
        }
    }, []);

    // Sign in - prompts wallet signature and creates/fetches user
    const signIn = useCallback(async (): Promise<boolean> => {
        if (!address || isAuthenticating) return false;

        setIsAuthenticating(true);

        try {
            // Check for existing valid session first
            const storedAuth = getStoredAuth();
            if (storedAuth) {
                const existingUser = await fetchUser(address);
                if (existingUser) {
                    setUser(existingUser);
                    setIsAuthenticating(false);
                    return true;
                }
            }

            // Create sign message
            const message = `Welcome to Eventify!\n\nSign this message to verify your wallet and access your account.\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;

            // Request signature
            const signature = await signMessageAsync({ message });

            // Store auth locally
            storeAuth(signature, message);

            // Register/fetch user via API
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address,
                    signature,
                    message,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Authentication failed");
            }

            setUser(data.user);
            return true;
        } catch (error) {
            console.error("Sign in failed:", error);
            clearAuth();
            return false;
        } finally {
            setIsAuthenticating(false);
        }
    }, [address, isAuthenticating, getStoredAuth, fetchUser, signMessageAsync, storeAuth, clearAuth]);

    // Sign out
    const signOut = useCallback(() => {
        clearAuth();
        disconnect();
    }, [clearAuth, disconnect]);

    // Update user profile
    const updateProfile = useCallback(
        async (data: Partial<User>): Promise<User | null> => {
            if (!address) return null;

            const storedAuth = getStoredAuth();
            if (!storedAuth) {
                // Need to re-authenticate
                const success = await signIn();
                if (!success) return null;
            }

            const auth = getStoredAuth();
            if (!auth) return null;

            try {
                const res = await fetch("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        address,
                        signature: auth.signature,
                        message: auth.message,
                        ...data,
                    }),
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
        [address, getStoredAuth, signIn]
    );

    // Auto sign-in when wallet connects
    useEffect(() => {
        if (!isConnected || !address) {
            clearAuth();
            return;
        }

        // Check if already authenticated
        const storedAuth = getStoredAuth();
        if (storedAuth && !user) {
            // Try to restore session
            fetchUser(address).then((existingUser) => {
                if (existingUser) {
                    setUser(existingUser);
                } else if (!hasPrompted) {
                    // User doesn't exist, prompt sign in
                    setHasPrompted(true);
                    signIn();
                }
            });
        } else if (!storedAuth && !hasPrompted && !isAuthenticating) {
            // No stored auth, prompt sign in
            setHasPrompted(true);
            signIn();
        }
    }, [isConnected, address, user, hasPrompted, isAuthenticating, getStoredAuth, fetchUser, signIn, clearAuth]);

    // Clear auth when wallet disconnects
    useEffect(() => {
        if (!isConnected) {
            clearAuth();
        }
    }, [isConnected, clearAuth]);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isAuthenticating,
                signIn,
                signOut,
                updateProfile,
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
