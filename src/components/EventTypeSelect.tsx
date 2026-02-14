"use client";

import { useState, useRef, useEffect } from "react";
import type { EventType } from "@/types/event";

interface EventTypeSelectProps {
    value: EventType;
    onChange: (value: EventType) => void;
    disabled?: boolean;
}

const OPTIONS: { value: EventType; label: string; description: string; icon: React.ReactNode }[] = [
    {
        value: "offline",
        label: "Offline Event (In-Person)",
        description: "In-person event — attendees will be physically present",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        value: "online",
        label: "Online Event (Virtual)",
        description: "Virtual event — attendees will join remotely",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
        ),
    },
];

export function EventTypeSelect({ value, onChange, disabled }: EventTypeSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = OPTIONS.find((o) => o.value === value) || OPTIONS[0];

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
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
                Event Type <span className="text-red-400">*</span>
            </label>
            <div ref={containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 cursor-pointer flex items-center justify-between gap-2 ${isOpen ? "border-purple-500 ring-2 ring-purple-500" : "border-white/10"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400">{selected.icon}</span>
                        <span className="text-white">{selected.label}</span>
                    </div>
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
                    <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                        {OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-3 text-left transition-colors cursor-pointer flex items-center justify-between ${option.value === value
                                    ? "bg-purple-500/20"
                                    : "hover:bg-slate-700"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={option.value === value ? "text-purple-400" : "text-gray-400"}>
                                        {option.icon}
                                    </span>
                                    <div>
                                        <div className={`text-sm font-medium ${option.value === value ? "text-purple-300" : "text-white"}`}>
                                            {option.label}
                                        </div>
                                        <div className="text-xs text-gray-500">{option.description}</div>
                                    </div>
                                </div>
                                {option.value === value && (
                                    <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
                {value === "online"
                    ? "Virtual event — attendees will join remotely"
                    : "In-person event — attendees will be physically present"}
            </p>
        </div>
    );
}
