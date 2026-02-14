"use client";

import { useState, useRef, useEffect, useMemo } from "react";

interface GmtOffsetPickerProps {
    value: string; // format: "+05:30" or "-04:00"
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function GmtOffsetPicker({ value, onChange, disabled = false }: GmtOffsetPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse current value
    const parsed = useMemo(() => {
        const match = value.match(/^([+-])(\d{1,2}):(\d{2})$/);
        if (match) {
            const sign = match[1] as "+" | "-";
            const hours = parseInt(match[2], 10);
            const minutes = parseInt(match[3], 10);
            return { sign, hours, minutes };
        }
        return { sign: "+" as const, hours: 0, minutes: 0 };
    }, [value]);

    const [sign, setSign] = useState<"+" | "-">(parsed.sign);
    const [hours, setHours] = useState(parsed.hours);
    const [minutes, setMinutes] = useState(parsed.minutes);

    // Sync state when value prop changes
    useEffect(() => {
        setSign(parsed.sign);
        setHours(parsed.hours);
        setMinutes(parsed.minutes);
    }, [parsed]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const updateValue = (newSign: "+" | "-", newHours: number, newMinutes: number) => {
        const formatted = `${newSign}${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
        onChange(formatted);
    };

    const handleSignChange = (newSign: "+" | "-") => {
        setSign(newSign);
        updateValue(newSign, hours, minutes);
    };

    const handleHoursChange = (newHours: number) => {
        const clamped = Math.max(0, Math.min(14, newHours)); // UTC-12 to UTC+14 covers all real offsets
        setHours(clamped);
        updateValue(sign, clamped, minutes);
    };

    const handleMinutesChange = (newMinutes: number) => {
        const clamped = Math.max(0, Math.min(59, newMinutes));
        setMinutes(clamped);
        updateValue(sign, hours, clamped);
    };

    const formatDisplay = () => {
        return `GMT${sign}${hours}:${String(minutes).padStart(2, "0")}`;
    };

    // Detect user's current GMT offset
    const detectOffset = () => {
        const offsetMinutes = -new Date().getTimezoneOffset(); // JS gives opposite sign
        const offsetSign = offsetMinutes >= 0 ? "+" : "-";
        const absMinutes = Math.abs(offsetMinutes);
        const offsetHours = Math.floor(absMinutes / 60);
        const offsetMins = absMinutes % 60;

        setSign(offsetSign as "+" | "-");
        setHours(offsetHours);
        setMinutes(offsetMins);
        updateValue(offsetSign as "+" | "-", offsetHours, offsetMins);
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white text-left focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 cursor-pointer flex items-center justify-between"
            >
                <span>{formatDisplay()}</span>
                <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-white/10 rounded-lg shadow-xl p-4">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="text-gray-400 text-sm">GMT</span>

                        {/* Sign Toggle */}
                        <div className="flex rounded-lg overflow-hidden border border-white/10">
                            <button
                                type="button"
                                onClick={() => handleSignChange("+")}
                                className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${sign === "+" ? "bg-purple-600 text-white" : "bg-slate-700 text-gray-400 hover:text-white"
                                    }`}
                            >
                                +
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSignChange("-")}
                                className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${sign === "-" ? "bg-purple-600 text-white" : "bg-slate-700 text-gray-400 hover:text-white"
                                    }`}
                            >
                                −
                            </button>
                        </div>

                        {/* Hours */}
                        <div className="flex flex-col items-center">
                            <button
                                type="button"
                                onClick={() => handleHoursChange(hours + 1)}
                                className="p-0.5 hover:bg-slate-700 rounded cursor-pointer"
                            >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                            <input
                                type="number"
                                value={hours}
                                onChange={(e) => handleHoursChange(parseInt(e.target.value) || 0)}
                                min={0}
                                max={14}
                                className="w-12 py-1 text-center text-lg font-mono text-white bg-slate-700/50 rounded border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                type="button"
                                onClick={() => handleHoursChange(hours - 1)}
                                className="p-0.5 hover:bg-slate-700 rounded cursor-pointer"
                            >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>

                        <span className="text-xl text-white font-mono">:</span>

                        {/* Minutes */}
                        <div className="flex flex-col items-center">
                            <button
                                type="button"
                                onClick={() => handleMinutesChange(minutes + 15)}
                                className="p-0.5 hover:bg-slate-700 rounded cursor-pointer"
                            >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                            <input
                                type="number"
                                value={String(minutes).padStart(2, "0")}
                                onChange={(e) => handleMinutesChange(parseInt(e.target.value) || 0)}
                                min={0}
                                max={59}
                                className="w-12 py-1 text-center text-lg font-mono text-white bg-slate-700/50 rounded border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                type="button"
                                onClick={() => handleMinutesChange(minutes - 15)}
                                className="p-0.5 hover:bg-slate-700 rounded cursor-pointer"
                            >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={detectOffset}
                        className="w-full px-3 py-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                        Use my current timezone
                    </button>
                </div>
            )}
        </div>
    );
}

/** Get user's current GMT offset in "+HH:MM" format */
export function getDefaultGmtOffset(): string {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    return `${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
