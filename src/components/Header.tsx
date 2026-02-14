"use client";

import Link from "next/link";
import { WalletConnect } from "./WalletConnect";
import { useGeolocationContext } from "./providers/GeolocationProvider";

function LocationDisplay() {
    const { city, latitude, longitude, loading, error, permissionStatus } = useGeolocationContext();

    if (loading) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Locating...</span>
            </div>
        );
    }

    if (error || permissionStatus === "denied") {
        return null;
    }

    if (latitude && longitude) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
                <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span>{city || "Fetching city..."}</span>
            </div>
        );
    }

    return null;
}

export function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Eventify
                        </span>
                    </Link>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-6">
                        <Link
                            href="/events"
                            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        >
                            Events
                        </Link>
                        <Link
                            href="/marketplace"
                            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        >
                            Marketplace
                        </Link>
                        <Link
                            href="/dashboard"
                            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        >
                            My Tickets
                        </Link>
                        <Link
                            href="/events/my-events"
                            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        >
                            My Events
                        </Link>
                        <Link
                            href="/verify"
                            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        >
                            Verify Ticket
                        </Link>
                        <Link
                            href="/profile"
                            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        >
                            Profile
                        </Link>
                    </nav>

                    {/* Wallet Connect */}
                    <div className="flex items-center gap-4">
                        <LocationDisplay />
                        <WalletConnect />
                    </div>
                </div>
            </div>
        </header>
    );
}
