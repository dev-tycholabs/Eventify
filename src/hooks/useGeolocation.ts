"use client";

import { useState, useEffect, useCallback } from "react";

export interface GeolocationState {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    city: string | null;
    error: string | null;
    loading: boolean;
    permissionStatus: PermissionState | null;
}

export function useGeolocation() {
    const [state, setState] = useState<GeolocationState>({
        latitude: null,
        longitude: null,
        accuracy: null,
        city: null,
        error: null,
        loading: true,
        permissionStatus: null,
    });

    const fetchCity = useCallback(async (lat: number, lon: number) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
                {
                    headers: {
                        "Accept-Language": "en",
                        "User-Agent": "Eventify/1.0 (https://eventifyyy.vercel.app; contact@eventifyyy.vercel.app)",
                    },
                }
            );
            const data = await response.json();
            const city =
                data.address?.city ||
                data.address?.town ||
                data.address?.village ||
                data.address?.municipality ||
                null;
            setState((prev) => ({ ...prev, city }));
        } catch {
            // Silently fail - city is optional
        }
    }, []);

    const requestLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setState((prev) => ({
                ...prev,
                error: "Geolocation is not supported by your browser",
                loading: false,
            }));
            return;
        }

        setState((prev) => ({ ...prev, loading: true, error: null }));

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setState({
                    latitude,
                    longitude,
                    accuracy,
                    city: null,
                    error: null,
                    loading: false,
                    permissionStatus: "granted",
                });
                fetchCity(latitude, longitude);
            },
            (error) => {
                let errorMessage = "Unknown error occurred";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Location permission denied";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Location information unavailable";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Location request timed out";
                        break;
                }
                setState((prev) => ({
                    ...prev,
                    error: errorMessage,
                    loading: false,
                    permissionStatus: "denied",
                }));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }, [fetchCity]);

    useEffect(() => {
        requestLocation();
    }, [requestLocation]);

    return { ...state, requestLocation };
}
