"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useEventsFromDB } from "@/hooks/useEventsFromDB";
import { useEventDates } from "@/hooks/useEventDates";
import { useGeolocationContext } from "@/components/providers/GeolocationProvider";
import { EventCard, EventCardSkeleton, EmptyState, EventCalendarFilter } from "@/components/events";
import { ChainFilter } from "@/components/ui/ChainFilter";

type LocationTab = "all" | "nearby" | "city" | "search";

const RADIUS_OPTIONS = [10, 25, 50, 100, 250, 500];

interface CityResult {
    id: number;
    name: string;
    state: string;
    country: string;
}

function RadiusSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Radius:</span>
            <div ref={containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`px-4 py-2 bg-slate-800/50 border rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer flex items-center gap-2 ${isOpen ? "border-purple-500 ring-2 ring-purple-500" : "border-white/10"
                        }`}
                >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm text-white">{value} km</span>
                    <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isOpen && (
                    <div className="absolute z-50 mt-1 right-0 min-w-full bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                        {RADIUS_OPTIONS.map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => {
                                    onChange(r);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer flex items-center justify-between ${r === value ? "bg-purple-500/20 text-purple-300" : "text-white hover:bg-slate-700"
                                    }`}
                            >
                                <span>{r} km</span>
                                {r === value && (
                                    <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CitySearchSelect({
    value,
    onChange,
}: {
    value: CityResult | null;
    onChange: (city: CityResult | null) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<CityResult[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const searchCities = useCallback(async (q: string) => {
        if (q.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/locations?type=city_search&q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setResults(data);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchCities(val), 300);
    };

    const handleSelect = (city: CityResult) => {
        onChange(city);
        setSearch("");
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSearch("");
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${value
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50"
                    }`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {value ? (
                    <>
                        {value.name}
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={handleClear}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") handleClear(e as unknown as React.MouseEvent);
                            }}
                            className="ml-1 p-0.5 hover:bg-purple-500 rounded-full transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </span>
                    </>
                ) : (
                    "Search City"
                )}
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 left-0 w-72 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-white/10">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Type a city name..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-white/10 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {loading && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">Searching...</div>
                        )}
                        {!loading && search.length >= 2 && results.length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">No cities found</div>
                        )}
                        {!loading && search.length < 2 && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">Type at least 2 characters</div>
                        )}
                        {results.map((city) => (
                            <button
                                key={`${city.id}-${city.state}-${city.country}`}
                                type="button"
                                onClick={() => handleSelect(city)}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer hover:bg-slate-700 ${value?.id === city.id ? "bg-purple-500/20 text-purple-300" : "text-white"
                                    }`}
                            >
                                <span className="font-medium">{city.name}</span>
                                <span className="text-gray-500 ml-1 text-xs">
                                    {city.state}{city.state && city.country ? ", " : ""}{city.country}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function EventsPage() {
    const { city, latitude, longitude, loading: locationLoading } = useGeolocationContext();
    const [activeTab, setActiveTab] = useState<LocationTab>("all");
    const [selectedRadius, setSelectedRadius] = useState(50);
    const [searchCity, setSearchCity] = useState<CityResult | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
    const calendarRef = useRef<HTMLDivElement>(null);

    // Close calendar on outside click
    useEffect(() => {
        if (!showCalendar) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
                setShowCalendar(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showCalendar]);

    const hasLocation = latitude !== null && longitude !== null;

    const fetchOptions = useMemo(() => {
        const base: Parameters<typeof useEventsFromDB>[0] = { status: "published" };

        if (activeTab === "nearby" && hasLocation) {
            base.lat = latitude;
            base.lon = longitude;
            base.radius = selectedRadius;
            base.sortByDistance = true;
        } else if (activeTab === "city" && city) {
            base.city = city;
        } else if (activeTab === "search" && searchCity) {
            base.city = searchCity.name;
        }

        if (selectedDate) {
            base.date = selectedDate;
        }

        if (selectedChainId) {
            base.chainId = selectedChainId;
        }

        return base;
    }, [activeTab, hasLocation, latitude, longitude, selectedRadius, city, searchCity, selectedDate, selectedChainId]);

    const { events, isLoading, error, refetch } = useEventsFromDB(fetchOptions);

    // Fetch event dates for the calendar dots from the API
    const { eventDates } = useEventDates(calendarYear, calendarMonth);

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Discover Events</h1>
                        <p className="text-gray-400">
                            Browse upcoming events and get your NFT tickets
                        </p>
                    </div>
                    <Link
                        href="/events/create"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-300 whitespace-nowrap"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Event
                    </Link>
                </div>

                {/* Location Tabs */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <button
                        onClick={() => setActiveTab("all")}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${activeTab === "all"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50"
                            }`}
                    >
                        All Events
                    </button>

                    <button
                        onClick={() => setActiveTab("nearby")}
                        disabled={!hasLocation && !locationLoading}
                        title={!hasLocation && !locationLoading ? "Location not available" : undefined}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${activeTab === "nearby"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50"
                            } ${!hasLocation && !locationLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {locationLoading ? "Locating..." : "Nearby"}
                    </button>

                    {city && (
                        <button
                            onClick={() => setActiveTab("city")}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${activeTab === "city"
                                ? "bg-purple-600 text-white"
                                : "bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            In {city}
                        </button>
                    )}

                    {/* Right-aligned: Radius + Search City + Calendar */}
                    <div className="flex items-center gap-3 ml-auto">
                        {activeTab === "nearby" && hasLocation && (
                            <RadiusSelect value={selectedRadius} onChange={setSelectedRadius} />
                        )}

                        <CitySearchSelect
                            value={activeTab === "search" ? searchCity : null}
                            onChange={(c) => {
                                setSearchCity(c);
                                setActiveTab(c ? "search" : "all");
                            }}
                        />

                        <ChainFilter value={selectedChainId} onChange={setSelectedChainId} />

                        {/* Calendar toggle */}
                        <div ref={calendarRef} className="relative">
                            <button
                                onClick={() => setShowCalendar(!showCalendar)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${showCalendar || selectedDate
                                    ? "bg-purple-600 text-white"
                                    : "bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50"
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {selectedDate
                                    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                    : "Select Date"
                                }
                                {selectedDate && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); setSelectedDate(null); }}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setSelectedDate(null); } }}
                                        className="ml-1 p-0.5 hover:bg-purple-500 rounded-full transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </span>
                                )}
                            </button>

                            {/* Calendar Filter Panel - floating overlay */}
                            {showCalendar && (
                                <div className="absolute z-50 right-0 mt-2 w-[300px]">
                                    <EventCalendarFilter
                                        eventDates={eventDates}
                                        selectedDate={selectedDate}
                                        onDateChange={setSelectedDate}
                                        onMonthChange={(y, m) => { setCalendarYear(y); setCalendarMonth(m); }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-red-400">{error.message}</p>
                            <button
                                onClick={() => refetch()}
                                className="ml-auto text-sm text-red-400 hover:text-red-300 underline"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <EventCardSkeleton key={i} />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && !error && events.length === 0 && (
                    <div className="text-center py-16">
                        {activeTab === "nearby" ? (
                            <div>
                                <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <h3 className="text-lg font-semibold text-white mb-2">No events nearby</h3>
                                <p className="text-gray-400 mb-4">
                                    No events found within {selectedRadius} km of your location.
                                </p>
                                <button
                                    onClick={() => setSelectedRadius((prev) => Math.min(prev * 2, 500))}
                                    className="text-purple-400 hover:text-purple-300 text-sm underline cursor-pointer"
                                >
                                    Try a larger radius
                                </button>
                            </div>
                        ) : activeTab === "city" ? (
                            <div>
                                <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <h3 className="text-lg font-semibold text-white mb-2">No events in {city}</h3>
                                <p className="text-gray-400 mb-4">
                                    There are no events in your city yet.
                                </p>
                                <button
                                    onClick={() => setActiveTab("nearby")}
                                    className="text-purple-400 hover:text-purple-300 text-sm underline cursor-pointer"
                                >
                                    Try nearby events instead
                                </button>
                            </div>
                        ) : activeTab === "search" && searchCity ? (
                            <div>
                                <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <h3 className="text-lg font-semibold text-white mb-2">No events in {searchCity.name}</h3>
                                <p className="text-gray-400 mb-4">
                                    There are no events in {searchCity.name}{searchCity.state ? `, ${searchCity.state}` : ""} yet.
                                </p>
                                <button
                                    onClick={() => { setSearchCity(null); setActiveTab("all"); }}
                                    className="text-purple-400 hover:text-purple-300 text-sm underline cursor-pointer"
                                >
                                    Browse all events
                                </button>
                            </div>
                        ) : selectedDate ? (
                            <div>
                                <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <h3 className="text-lg font-semibold text-white mb-2">No events on this date</h3>
                                <p className="text-gray-400 mb-4">
                                    No events found on {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                                </p>
                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="text-purple-400 hover:text-purple-300 text-sm underline cursor-pointer"
                                >
                                    Clear date filter
                                </button>
                            </div>
                        ) : (
                            <EmptyState />
                        )}
                    </div>
                )}

                {/* Events Grid */}
                {!isLoading && events.length > 0 && (
                    <>
                        {activeTab === "nearby" && (
                            <p className="text-sm text-gray-500 mb-4">
                                Showing {events.length} event{events.length !== 1 ? "s" : ""} within {selectedRadius} km
                            </p>
                        )}
                        {activeTab === "search" && searchCity && (
                            <p className="text-sm text-gray-500 mb-4">
                                Showing {events.length} event{events.length !== 1 ? "s" : ""} in {searchCity.name}{searchCity.state ? `, ${searchCity.state}` : ""}
                            </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {events.map((event) => (
                                <EventCard key={event.id} event={event} showDistance={activeTab === "nearby"} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
