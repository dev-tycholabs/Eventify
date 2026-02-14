"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface LocationOption {
    id: number;
    name: string;
}

export interface LocationValue {
    countryId: number | null;
    countryName: string;
    stateId: number | null;
    stateName: string;
    cityId: number | null;
    cityName: string;
}

interface LocationPickerProps {
    value: LocationValue;
    onChange: (value: LocationValue) => void;
    disabled?: boolean;
}

const emptyLocation: LocationValue = {
    countryId: null,
    countryName: "",
    stateId: null,
    stateName: "",
    cityId: null,
    cityName: "",
};

/* ─── Searchable Select Dropdown ─── */

interface SearchableSelectProps {
    label: string;
    placeholder: string;
    options: LocationOption[];
    value: number | null;
    displayValue: string;
    onChange: (id: number | null, name: string) => void;
    disabled?: boolean;
    loading?: boolean;
    icon: React.ReactNode;
}

function SearchableSelect({
    label,
    placeholder,
    options,
    value,
    displayValue,
    onChange,
    disabled = false,
    loading = false,
    icon,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filtered = search
        ? options.filter((o) =>
            o.name.toLowerCase().includes(search.toLowerCase())
        )
        : options;

    const handleSelect = (option: LocationOption) => {
        onChange(option.id, option.name);
        setIsOpen(false);
        setSearch("");
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null, "");
        setSearch("");
    };

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
            <button
                type="button"
                onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
                disabled={disabled || loading}
                className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 cursor-pointer flex items-center justify-between gap-2 ${isOpen ? "border-purple-500 ring-2 ring-purple-500" : "border-white/10"
                    }`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-gray-400 flex-shrink-0">{icon}</span>
                    <span
                        className={`truncate ${displayValue ? "text-white" : "text-gray-500"
                            }`}
                    >
                        {loading
                            ? "Loading..."
                            : displayValue || placeholder}
                    </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {value && !disabled && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={handleClear}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") handleClear(e as unknown as React.MouseEvent);
                            }}
                            className="p-0.5 hover:bg-slate-700 rounded transition-colors text-gray-400 hover:text-white cursor-pointer"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </span>
                    )}
                    <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""
                            }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {/* Search input */}
                    <div className="p-2 border-b border-white/10">
                        <div className="relative">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={`Search ${label.toLowerCase()}...`}
                                className="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-white/10 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                {search ? "No results found" : "No options available"}
                            </div>
                        ) : (
                            filtered.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option)}
                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between cursor-pointer ${option.id === value
                                        ? "bg-purple-500/20 text-purple-300"
                                        : "text-white hover:bg-slate-700"
                                        }`}
                                >
                                    <span>{option.name}</span>
                                    {option.id === value && (
                                        <svg
                                            className="w-4 h-4 text-purple-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


/* ─── Main LocationPicker Component ─── */

export function LocationPicker({ value, onChange, disabled }: LocationPickerProps) {
    const [countries, setCountries] = useState<LocationOption[]>([]);
    const [states, setStates] = useState<LocationOption[]>([]);
    const [cities, setCities] = useState<LocationOption[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(false);
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    // Fetch countries on mount
    useEffect(() => {
        setLoadingCountries(true);
        fetch("/api/locations?type=countries")
            .then((res) => res.json())
            .then((data) => setCountries(data))
            .catch(console.error)
            .finally(() => setLoadingCountries(false));
    }, []);

    const fetchStates = useCallback(async (countryId: number) => {
        setLoadingStates(true);
        setStates([]);
        setCities([]);
        try {
            const res = await fetch(
                `/api/locations?type=states&country_id=${countryId}`
            );
            const data = await res.json();
            setStates(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingStates(false);
        }
    }, []);

    const fetchCities = useCallback(async (stateId: number) => {
        setLoadingCities(true);
        setCities([]);
        try {
            const res = await fetch(
                `/api/locations?type=cities&state_id=${stateId}`
            );
            const data = await res.json();
            setCities(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingCities(false);
        }
    }, []);

    // Resolve names to IDs when loading from a draft (has names but no IDs)
    useEffect(() => {
        if (countries.length > 0 && value.countryName && !value.countryId) {
            const match = countries.find(
                (c) => c.name.toLowerCase() === value.countryName.toLowerCase()
            );
            if (match) {
                onChange({ ...value, countryId: match.id });
                fetchStates(match.id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countries]);

    useEffect(() => {
        if (states.length > 0 && value.stateName && !value.stateId) {
            const match = states.find(
                (s) => s.name.toLowerCase() === value.stateName.toLowerCase()
            );
            if (match) {
                onChange({ ...value, stateId: match.id });
                fetchCities(match.id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [states]);

    useEffect(() => {
        if (cities.length > 0 && value.cityName && !value.cityId) {
            const match = cities.find(
                (c) => c.name.toLowerCase() === value.cityName.toLowerCase()
            );
            if (match) {
                onChange({ ...value, cityId: match.id });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cities]);

    // Load states/cities if value already has selections (e.g. loading a draft)
    useEffect(() => {
        if (value.countryId && states.length === 0) fetchStates(value.countryId);
    }, [value.countryId, states.length, fetchStates]);

    useEffect(() => {
        if (value.stateId && cities.length === 0) fetchCities(value.stateId);
    }, [value.stateId, cities.length, fetchCities]);

    const handleCountryChange = (id: number | null, name: string) => {
        onChange({ ...emptyLocation, countryId: id, countryName: name });
        if (id) fetchStates(id);
        else {
            setStates([]);
            setCities([]);
        }
    };

    const handleStateChange = (id: number | null, name: string) => {
        onChange({
            ...value,
            stateId: id,
            stateName: name,
            cityId: null,
            cityName: "",
        });
        if (id) fetchCities(id);
        else setCities([]);
    };

    const handleCityChange = (id: number | null, name: string) => {
        onChange({ ...value, cityId: id, cityName: name });
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
                Event Location
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SearchableSelect
                    label="Country"
                    placeholder="Select country"
                    options={countries}
                    value={value.countryId}
                    displayValue={value.countryName}
                    onChange={handleCountryChange}
                    disabled={disabled}
                    loading={loadingCountries}
                    icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
                <SearchableSelect
                    label="State"
                    placeholder={value.countryId ? "Select state" : "Select country first"}
                    options={states}
                    value={value.stateId}
                    displayValue={value.stateName}
                    onChange={handleStateChange}
                    disabled={disabled || !value.countryId}
                    loading={loadingStates}
                    icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    }
                />
                <SearchableSelect
                    label="City"
                    placeholder={value.stateId ? "Select city" : "Select state first"}
                    options={cities}
                    value={value.cityId}
                    displayValue={value.cityName}
                    onChange={handleCityChange}
                    disabled={disabled || !value.stateId}
                    loading={loadingCities}
                    icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    }
                />
            </div>
        </div>
    );
}
