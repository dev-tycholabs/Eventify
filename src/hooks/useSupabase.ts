"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { useChainConfig } from "./useChainConfig";
import type { Tables, InsertTables, EventStatus } from "@/lib/supabase/types";

type User = Tables<"users">;
type Event = Tables<"events">;

const AUTH_STORAGE_KEY = "eventify_auth";

interface StoredAuth {
    address: string;
    signature: string;
    message: string;
    timestamp: number;
}

export function useSupabase() {
    const { address } = useAccount();
    const { chainId } = useChainConfig();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper to get stored auth from initial wallet connection
    const getStoredAuth = useCallback((): StoredAuth | null => {
        if (typeof window === "undefined" || !address) return null;
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

    // Fetch user profile
    const getUser = useCallback(
        async (walletAddress?: string): Promise<User | null> => {
            const addr = walletAddress || address;
            if (!addr) return null;

            try {
                const res = await fetch(`/api/users?address=${addr}`);
                const data = await res.json();
                return data.user;
            } catch (err) {
                console.error("Error fetching user:", err);
                return null;
            }
        },
        [address]
    );

    // Create or update user profile
    const saveUser = useCallback(
        async (userData: {
            username?: string;
            name?: string;
            email?: string;
            contact_number?: string;
            bio?: string;
            avatar_url?: string;
        }): Promise<User | null> => {
            if (!address) {
                setError("Wallet not connected");
                return null;
            }

            const storedAuth = getStoredAuth();
            if (!storedAuth) {
                setError("Please reconnect your wallet");
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                const res = await fetch("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        address,
                        message: storedAuth.message,
                        signature: storedAuth.signature,
                        ...userData,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to save user");
                }

                return data.user;
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : "Failed to save user";
                setError(msg);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [address, getStoredAuth]
    );

    // Fetch events
    const getEvents = useCallback(
        async (options?: {
            organizer?: string;
            status?: EventStatus;
        }): Promise<Event[]> => {
            try {
                const params = new URLSearchParams();
                if (options?.organizer) params.set("organizer", options.organizer);
                if (options?.status) params.set("status", options.status);

                const url = `/api/events${params.toString() ? `?${params}` : ""}`;
                const res = await fetch(url);
                const data = await res.json();
                return data.events || [];
            } catch (err) {
                console.error("Error fetching events:", err);
                return [];
            }
        },
        []
    );

    // Get user's drafts
    const getDrafts = useCallback(async (): Promise<Event[]> => {
        if (!address) return [];
        return getEvents({ organizer: address, status: "draft" });
    }, [address, getEvents]);

    // Get user's published events
    const getMyEvents = useCallback(async (): Promise<Event[]> => {
        if (!address) return [];
        return getEvents({ organizer: address, status: "published" });
    }, [address, getEvents]);

    // Save event (create or update)
    const saveEvent = useCallback(
        async (
            eventData: Partial<InsertTables<"events">> & { name: string },
            eventId?: string
        ): Promise<Event | null> => {
            if (!address) {
                setError("Wallet not connected");
                return null;
            }

            const storedAuth = getStoredAuth();
            if (!storedAuth) {
                setError("Please reconnect your wallet");
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                const res = await fetch("/api/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        address,
                        message: storedAuth.message,
                        signature: storedAuth.signature,
                        event_id: eventId,
                        chain_id: eventData.chain_id ?? chainId,
                        ...eventData,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to save event");
                }

                return data.event;
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : "Failed to save event";
                setError(msg);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [address, getStoredAuth, chainId]
    );

    // Save as draft
    const saveDraft = useCallback(
        async (
            eventData: Partial<InsertTables<"events">> & { name: string },
            eventId?: string
        ): Promise<Event | null> => {
            return saveEvent({ ...eventData, status: "draft" }, eventId);
        },
        [saveEvent]
    );

    // Publish event (update status to published)
    const publishEvent = useCallback(
        async (
            eventData: Partial<InsertTables<"events">> & { name: string },
            eventId?: string
        ): Promise<Event | null> => {
            return saveEvent({ ...eventData, status: "published" }, eventId);
        },
        [saveEvent]
    );

    // Delete draft
    const deleteDraft = useCallback(
        async (eventId: string): Promise<boolean> => {
            if (!address) {
                setError("Wallet not connected");
                return false;
            }

            const storedAuth = getStoredAuth();
            if (!storedAuth) {
                setError("Please reconnect your wallet");
                return false;
            }

            setIsLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    id: eventId,
                    address,
                    message: storedAuth.message,
                    signature: storedAuth.signature,
                });

                const res = await fetch(`/api/events?${params}`, {
                    method: "DELETE",
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to delete draft");
                }

                return true;
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : "Failed to delete draft";
                setError(msg);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [address, getStoredAuth]
    );

    return {
        isLoading,
        error,
        // User operations
        getUser,
        saveUser,
        // Event operations
        getEvents,
        getDrafts,
        getMyEvents,
        saveEvent,
        saveDraft,
        publishEvent,
        deleteDraft,
    };
}
