"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Fetches distinct event dates for a given month from the API.
 * Returns a Set<string> of "YYYY-MM-DD" strings.
 */
export function useEventDates(year: number, month: number) {
    const [eventDates, setEventDates] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);

    const fetchDates = useCallback(async () => {
        setIsLoading(true);
        try {
            const monthStr = `${year}-${String(month).padStart(2, "0")}`;
            const res = await fetch(`/api/events?status=published&month=${monthStr}&dates_only=true`);
            if (!res.ok) throw new Error("Failed to fetch event dates");
            const data = await res.json();
            setEventDates(new Set(data.dates || []));
        } catch {
            setEventDates(new Set());
        } finally {
            setIsLoading(false);
        }
    }, [year, month]);

    useEffect(() => {
        fetchDates();
    }, [fetchDates]);

    return { eventDates, isLoading };
}
