"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/providers/AuthProvider";
import { useChainConfig } from "./useChainConfig";
import type { Tables, InsertTables, EventStatus } from "@/lib/supabase/types";

type User = Tables<"users">;
type Event = Tables<"events">;

export function useSupabase() {
    const { address } = useAccount();
    const { getAccessToken } = useAuth();
    const { chainId } = useChainConfig();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper to make authenticated requests
    const authFetch = useCallback(
        async (url: string, options: RequestInit = {}): Promise<Response> => {
            const token = await getAccessToken();
            if (!token) {
                throw new Error("Not authenticated. Please sign in.");
            }

            const headers = new Headers(options.headers);
            headers.set("Authorization", `Bearer ${token}`);
            if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
                headers.set("Content-Type", "application/json");
            }

            return fetch(url, { ...options, headers });
        },
        [getAccessToken]
    );

    // Fetch user profile (public — no auth needed)
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

    // Create or update user profile (authenticated)
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

            setIsLoading(true);
            setError(null);

            try {
                const res = await authFetch("/api/users", {
                    method: "POST",
                    body: JSON.stringify(userData),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to save user");
                }

                return data.user;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to save user";
                setError(msg);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [address, authFetch]
    );

    // Fetch events (public)
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

    // Save event (authenticated)
    const saveEvent = useCallback(
        async (
            eventData: Partial<InsertTables<"events">> & { name: string },
            eventId?: string
        ): Promise<Event | null> => {
            if (!address) {
                setError("Wallet not connected");
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                const res = await authFetch("/api/events", {
                    method: "POST",
                    body: JSON.stringify({
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
                const msg = err instanceof Error ? err.message : "Failed to save event";
                setError(msg);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [address, authFetch, chainId]
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

    // Publish event
    const publishEvent = useCallback(
        async (
            eventData: Partial<InsertTables<"events">> & { name: string },
            eventId?: string
        ): Promise<Event | null> => {
            return saveEvent({ ...eventData, status: "published" }, eventId);
        },
        [saveEvent]
    );

    // Delete draft (authenticated)
    const deleteDraft = useCallback(
        async (eventId: string): Promise<boolean> => {
            if (!address) {
                setError("Wallet not connected");
                return false;
            }

            setIsLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({ id: eventId });
                const res = await authFetch(`/api/events?${params}`, {
                    method: "DELETE",
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to delete draft");
                }

                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to delete draft";
                setError(msg);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [address, authFetch]
    );

    return {
        isLoading,
        error,
        authFetch,
        getUser,
        saveUser,
        getEvents,
        getDrafts,
        getMyEvents,
        saveEvent,
        saveDraft,
        publishEvent,
        deleteDraft,
    };
}
