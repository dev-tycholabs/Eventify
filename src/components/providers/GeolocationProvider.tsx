"use client";

import { createContext, useContext, ReactNode } from "react";
import { useGeolocation, GeolocationState } from "@/hooks";

interface GeolocationContextType extends GeolocationState {
    requestLocation: () => void;
}

const GeolocationContext = createContext<GeolocationContextType | null>(null);

export function GeolocationProvider({ children }: { children: ReactNode }) {
    const geolocation = useGeolocation();

    return (
        <GeolocationContext.Provider value={geolocation}>
            {children}
        </GeolocationContext.Provider>
    );
}

export function useGeolocationContext() {
    const context = useContext(GeolocationContext);
    if (!context) {
        throw new Error("useGeolocationContext must be used within a GeolocationProvider");
    }
    return context;
}
